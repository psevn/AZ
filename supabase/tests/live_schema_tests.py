"""AZ audit tests against a LOCAL replica of the live schema (never the real project).

Covers SPEC v0.2 §5.5 (isolation), §7 (quiz security), §10 (DB part of account deletion)
as far as the CURRENT live schema allows, plus an informational "SPEC conformance" section.

Output: PASS / FAIL per check, GAP for known differences from the approved SPEC
(GAPs do not fail the run). Exit code 1 only if a FAIL occurred.
Uses only the standard library: every check shells out to psql as a fresh session.
"""
import os
import re
import subprocess
import sys

PORT = os.environ.get("AZ_PG_PORT", "54329")
BASE = ["psql", "-X", "-q", "-t", "-A", "-F", "|", "-v", "VERBOSITY=verbose", "-v", "ON_ERROR_STOP=1",
        "-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-d", "az_test"]

A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
KIND = dict(subjects=1, tasks=2, focus_sessions=3, documents=4, notes=5, quizzes=6,
            quiz_questions=7, quiz_attempts=8, ai_usage_log=9)

results = []  # (name, status, detail)


def rid(user, table):
    prefix = "aaaaaaaa" if user == A else "bbbbbbbb"
    return f"{prefix}-0000-0000-0000-0000000000{KIND[table]:02d}"


class R:
    def __init__(self, ok, state, rows, err):
        self.ok, self.state, self.rows, self.err = ok, state, rows, err

    def scalar(self):
        return self.rows[0][0] if self.rows else None


def run(sql, role=None, uid=None):
    args = BASE[:]
    if role:
        args += ["-c", f"set role {role}"]
    if uid:
        args += ["-c", f"set request.jwt.claim.sub = '{uid}'"]
    args += ["-c", sql]
    p = subprocess.run(args, capture_output=True, text=True)
    m = re.search(r"ERROR:\s+([0-9A-Z]{5}):", p.stderr)
    rows = [l.split("|") for l in p.stdout.strip().splitlines() if l.strip()] if p.returncode == 0 else []
    return R(p.returncode == 0, m.group(1) if m else None, rows, p.stderr.strip())


def check(name, cond, detail=""):
    results.append((name, "PASS" if cond else "FAIL", detail))
    print(("PASS  " if cond else "FAIL  ") + name + (f"   [{detail}]" if (detail and not cond) else ""))


def gap(name, detail):
    results.append((name, "GAP", detail))
    print(f"GAP   {name}   [{detail}]")


def expect(name, sqlstate, sql, role=None, uid=None):
    r = run(sql, role, uid)
    check(name, (not r.ok) and r.state == sqlstate, f"expected {sqlstate}, got ok={r.ok} state={r.state} {r.err[:120]}")


def count(sql, role=None, uid=None):
    r = run(f"select count(*) from ({sql}) t", role, uid)
    return int(r.scalar()) if r.ok else None


def affected(dml, role=None, uid=None):
    """Rows touched by an UPDATE/DELETE (None if it errored)."""
    r = run(f"with x as ({dml} returning 1) select count(*) from x", role, uid)
    return int(r.scalar()) if r.ok else None


def seed():
    sql = ["truncate auth.users cascade;",
           f"insert into auth.users (id, email, raw_user_meta_data) values "
           f"('{A}','a@test','{{\"display_name\":\"A\"}}'), ('{B}','b@test',null);"]
    for u in (A, B):
        s, t, f, d, n, q, qq, at, lg = (rid(u, k) for k in
                                        ("subjects", "tasks", "focus_sessions", "documents", "notes", "quizzes",
                                         "quiz_questions", "quiz_attempts", "ai_usage_log"))
        sql += [
            f"insert into subjects (id,user_id,name) values ('{s}','{u}','subj');",
            f"insert into tasks (id,user_id,subject_id,title) values ('{t}','{u}','{s}','task');",
            f"insert into focus_sessions (id,user_id,task_id) values ('{f}','{u}','{t}');",
            f"insert into documents (id,user_id,subject_id,title,storage_path) values ('{d}','{u}','{s}','doc','{u}/doc.pdf');",
            f"insert into notes (id,user_id,document_id,body) values ('{n}','{u}','{d}','note');",
            f"insert into quizzes (id,user_id,document_id) values ('{q}','{u}','{d}');",
            f"insert into quiz_questions (id,user_id,quiz_id,prompt,choices) values ('{qq}','{u}','{q}','q?','[\"x\",\"y\",\"z\"]');",
            f"insert into private.question_keys (question_id,user_id,correct_index,explanation) values ('{qq}','{u}',1,'because');",
            f"insert into quiz_attempts (id,user_id,question_id,chosen_index,is_correct) values ('{at}','{u}','{qq}',0,false);",
            f"insert into ai_usage_log (id,user_id,feature,model) values ('{lg}','{u}','quiz','m');",
        ]
    r = run(" ".join(sql))
    if not r.ok:
        print("SEED FAILED:", r.err)
        sys.exit(2)


OWNER_COL = {"profiles": "id", "subjects": "user_id", "tasks": "user_id", "focus_sessions": "user_id",
             "notes": "user_id", "documents": "user_id", "quizzes": "user_id", "quiz_questions": "user_id",
             "quiz_attempts": "user_id", "ai_usage_log": "user_id"}
WRITABLE = ["subjects", "tasks", "focus_sessions", "notes"]
READ_ONLY = ["documents", "quizzes", "quiz_questions", "quiz_attempts", "ai_usage_log"]
SET_COL = {"subjects": "name = 'hacked'", "tasks": "title = 'hacked'",
           "focus_sessions": "ended_at = now()", "notes": "body = 'hacked'"}


def t_read_isolation():
    seed()
    for t, oc in OWNER_COL.items():
        own = count(f"select 1 from {t} where {oc} = '{A}'", "authenticated", A)
        check(f"read: owner A sees own rows in {t} (positive control)", own == 1, f"count={own}")
        seen = count(f"select 1 from {t} where {oc} = '{A}'", "authenticated", B)
        row_id = A if t == "profiles" else rid(A, t)
        by_id = count(f"select 1 from {t} where id = '{row_id}'", "authenticated", B)
        check(f"read: B sees 0 of A's rows in {t} (by owner and by known id)", seen == 0 and by_id == 0,
              f"owner={seen} id={by_id}")
        total_b = count(f"select 1 from {t}", "authenticated", B)
        check(f"read: B's full scan of {t} returns only B's own row", total_b == 1, f"rows={total_b}")


def t_write_isolation():
    seed()
    for t in WRITABLE:
        up = affected(f"update {t} set {SET_COL[t]} where id = '{rid(A, t)}'", "authenticated", B)
        dl = affected(f"delete from {t} where id = '{rid(A, t)}'", "authenticated", B)
        still = count(f"select 1 from {t} where id = '{rid(A, t)}'")
        check(f"write: B cannot update/delete A's row in {t}", up == 0 and dl == 0 and still == 1,
              f"up={up} del={dl} still={still}")
        up_own = affected(f"update {t} set {SET_COL[t]} where id = '{rid(B, t)}'", "authenticated", B)
        check(f"write: B can update own row in {t} (positive control)", up_own == 1, f"up={up_own}")
    for t in READ_ONLY:
        expect(f"write: update on read-only {t} denied", "42501",
               f"update {t} set user_id = user_id where id = '{rid(A, t)}'", "authenticated", B)
        expect(f"write: delete on read-only {t} denied", "42501",
               f"delete from {t} where id = '{rid(A, t)}'", "authenticated", B)
    expect("write: owner cannot insert documents directly", "42501",
           f"insert into documents (user_id,title,storage_path) values ('{A}','x','{A}/x.pdf')", "authenticated", A)
    expect("write: owner cannot insert quizzes directly", "42501",
           f"insert into quizzes (user_id) values ('{A}')", "authenticated", A)
    expect("write: owner cannot insert ai_usage_log directly", "42501",
           f"insert into ai_usage_log (user_id,feature,model) values ('{A}','x','m')", "authenticated", A)
    expect("write: B cannot insert a subject owned by A (RLS)", "42501",
           f"insert into subjects (user_id,name) values ('{A}','x')", "authenticated", B)
    expect("write: B cannot re-assign own subject to A (WITH CHECK)", "42501",
           f"update subjects set user_id = '{A}' where id = '{rid(B, 'subjects')}'", "authenticated", B)
    r = run(f"insert into subjects (user_id,name) values ('{B}','mine')", "authenticated", B)
    check("write: B can insert own subject (positive control)", r.ok, r.err)


def t_composite_fk():
    seed()
    expect("fk: B task pointing at A's subject rejected (23503)", "23503",
           f"insert into tasks (user_id,subject_id,title) values ('{B}','{rid(A, 'subjects')}','x')", "authenticated", B)
    expect("fk: B focus session pointing at A's task rejected (23503)", "23503",
           f"insert into focus_sessions (user_id,task_id) values ('{B}','{rid(A, 'tasks')}')", "authenticated", B)
    expect("fk: B note pointing at A's document rejected (23503)", "23503",
           f"insert into notes (user_id,document_id,body) values ('{B}','{rid(A, 'documents')}','x')", "authenticated", B)
    cases = {
        "document -> A's subject": f"insert into documents (user_id,subject_id,title,storage_path) values ('{B}','{rid(A, 'subjects')}','t','{B}/p.pdf')",
        "quiz -> A's document": f"insert into quizzes (user_id,document_id) values ('{B}','{rid(A, 'documents')}')",
        "question -> A's quiz": f"insert into quiz_questions (user_id,quiz_id,prompt,choices) values ('{B}','{rid(A, 'quizzes')}','x','[]')",
        "attempt -> A's question": f"insert into quiz_attempts (user_id,question_id,chosen_index,is_correct) values ('{B}','{rid(A, 'quiz_questions')}',0,false)",
        "answer key -> A's question": f"insert into private.question_keys (question_id,user_id,correct_index) values ('{rid(A, 'quiz_questions')}','{B}',0)",
        "moving A's task to user B": f"update tasks set user_id = '{B}' where id = '{rid(A, 'tasks')}'",
    }
    # the answer-key case needs A's question WITHOUT a key, otherwise the primary key fires first
    run(f"delete from private.question_keys where question_id = '{rid(A, 'quiz_questions')}'")
    for name, sql in cases.items():
        expect(f"fk (service_role bypasses RLS): {name} rejected", "23503", sql, "service_role")


ALL_PUBLIC = list(OWNER_COL)


def t_anon_and_server_only():
    seed()
    for t in ALL_PUBLIC:
        expect(f"anon: select on {t} denied", "42501", f"select * from {t}", "anon")
    expect("anon: select on private.question_keys denied", "42501", "select * from private.question_keys", "anon")
    expect("anon: insert subject denied", "42501", f"insert into subjects (user_id,name) values ('{A}','x')", "anon")
    expect("anon: cannot run submit_answer", "42501",
           f"select * from public.submit_answer('{rid(A, 'quiz_questions')}'::uuid, 1::smallint)", "anon")
    expect("server-only: even the OWNER cannot select private.question_keys", "42501",
           "select * from private.question_keys", "authenticated", A)
    expect("server-only: owner cannot insert private.question_keys", "42501",
           f"insert into private.question_keys (question_id,user_id,correct_index) values ('{rid(A, 'quiz_questions')}','{A}',0)",
           "authenticated", A)
    expect("server-only: owner cannot update private.question_keys", "42501",
           "update private.question_keys set correct_index = 0", "authenticated", A)
    expect("server-only: authenticated cannot call handle_new_user", "42501", "select public.handle_new_user()",
           "authenticated", A)


def t_quiz_security():
    seed()
    cols = run("select column_name from information_schema.columns where table_schema='public' and table_name='quiz_questions'")
    names = {r[0] for r in cols.rows}
    leak = names & {"correct_index", "correct_option", "explanation", "answer", "is_correct"}
    check("quiz: quiz_questions has no answer columns", not leak, f"leak={leak}")
    q = rid(A, "quiz_questions")
    r = run(f"select is_correct, correct_index, explanation from public.submit_answer('{q}'::uuid, 1::smallint)", "authenticated", A)
    check("quiz: correct answer graded server-side, key revealed only after submit",
          r.ok and r.rows and r.rows[0][:3] == ["t", "1", "because"], f"{r.rows} {r.err[:100]}")
    r = run(f"select is_correct from public.submit_answer('{q}'::uuid, 0::smallint)", "authenticated", A)
    check("quiz: wrong answer graded false", r.ok and r.rows and r.rows[0][0] == "f", f"{r.rows} {r.err[:100]}")
    expect("quiz: B cannot answer A's question (not found, P0002)", "P0002",
           f"select * from public.submit_answer('{q}'::uuid, 1::smallint)", "authenticated", B)
    expect("quiz: unauthenticated call rejected (28000)", "28000",
           f"select * from public.submit_answer('{q}'::uuid, 1::smallint)", "authenticated")
    expect("quiz: index out of range rejected (22023)", "22023",
           f"select * from public.submit_answer('{q}'::uuid, 9::smallint)", "authenticated", A)
    expect("quiz: negative index rejected (22023)", "22023",
           f"select * from public.submit_answer('{q}'::uuid, (-1)::smallint)", "authenticated", A)
    n = count(f"select 1 from quiz_attempts where question_id = '{q}'", "authenticated", A)
    check("quiz: attempts recorded only through the RPC (seed 1 + 2 valid calls = 3)", n == 3, f"n={n}")
    check("quiz: B's attempts untouched by A's calls",
          count(f"select 1 from quiz_attempts where user_id = '{B}'") == 1)
    expect("quiz: client cannot forge an attempt", "42501",
           f"insert into quiz_attempts (user_id,question_id,chosen_index,is_correct) values ('{A}','{q}',1,true)", "authenticated", A)
    expect("quiz: client cannot flip is_correct", "42501",
           f"update quiz_attempts set is_correct = true where id = '{rid(A, 'quiz_attempts')}'", "authenticated", A)
    r1 = run(f"select 1 from public.submit_answer('{q}'::uuid, 1::smallint)", "authenticated", A)
    if r1.ok:
        gap("quiz: the same question can be submitted unlimited times and always reveals the answer",
            "no attempt/session model; SPEC §5.4 expects quiz_attempts (per quiz, with score) + attempt_answers")


def t_profiles_and_trigger():
    seed()
    check("trigger: auth user creation auto-creates profiles for both users", count("select 1 from profiles") == 2)
    check("trigger: display_name copied from metadata",
          run(f"select display_name from profiles where id = '{A}'").scalar() == "A")
    n = affected(f"update profiles set display_name = 'New' where id = '{A}'", "authenticated", A)
    check("profiles: owner can edit own display_name (positive control)", n == 1)
    expect("profiles: owner cannot change profile id", "42501", f"update profiles set id = gen_random_uuid() where id = '{A}'", "authenticated", A)
    expect("profiles: owner cannot change created_at", "42501", f"update profiles set created_at = now() where id = '{A}'", "authenticated", A)
    check("profiles: B cannot update A's profile", affected(f"update profiles set display_name = 'x' where id = '{A}'", "authenticated", B) == 0)
    expect("profiles: client cannot insert a profile", "42501", f"insert into profiles (id) values ('{A}')", "authenticated", A)
    expect("profiles: client cannot delete a profile", "42501", f"delete from profiles where id = '{A}'", "authenticated", A)


def t_constraints():
    seed()
    expect("constraint: document path must start with owner id (23514)", "23514",
           f"insert into documents (user_id,title,storage_path) values ('{B}','x','{A}/x.pdf')", "service_role")
    expect("constraint: document status 'completed' rejected (live vocabulary is 'ready')", "23514",
           f"update documents set status = 'completed' where id = '{rid(A, 'documents')}'", "service_role")
    r = run(f"update documents set status = 'ready' where id = '{rid(A, 'documents')}'", "service_role")
    check("constraint: document status 'ready' accepted", r.ok, r.err)
    expect("constraint: storage_path must be unique (23505)", "23505",
           f"insert into documents (user_id,title,storage_path) values ('{A}','dup','{A}/doc.pdf')", "service_role")
    expect("constraint: task priority outside 1..3 rejected (23514)", "23514",
           f"update tasks set priority = 5 where id = '{rid(A, 'tasks')}'", "service_role")
    expect("constraint: focus session cannot end before it starts (23514)", "23514",
           f"update focus_sessions set ended_at = started_at - interval '1 hour' where id = '{rid(A, 'focus_sessions')}'", "service_role")
    b = run("select public::text, file_size_limit, allowed_mime_types::text from storage.buckets where id='documents'").rows
    check("storage: bucket 'documents' is private and PDF-only", b and b[0][0] == "false" and b[0][2] == "{application/pdf}", str(b))
    check("rls: enabled on every table in public and private",
          count("select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') "
                "and c.relkind='r' and not c.relrowsecurity") == 0)
    check("rls: private.question_keys has zero policies (default deny)",
          count("select 1 from pg_policies where schemaname='private'") == 0)


def t_storage_policies():
    seed()
    r = run(f"insert into storage.objects (bucket_id,name) values ('documents','{A}/f.pdf')", "authenticated", A)
    check("storage: owner can add an object under own folder (positive control)", r.ok, r.err)
    expect("storage: B cannot add an object under A's folder", "42501",
           f"insert into storage.objects (bucket_id,name) values ('documents','{A}/evil.pdf')", "authenticated", B)
    expect("storage: A cannot add an object under B's folder", "42501",
           f"insert into storage.objects (bucket_id,name) values ('documents','{B}/evil.pdf')", "authenticated", A)
    check("storage: B cannot see A's object",
          count(f"select 1 from storage.objects where name = '{A}/f.pdf'", "authenticated", B) == 0)
    check("storage: B cannot update/delete A's object",
          affected(f"update storage.objects set name = name where name = '{A}/f.pdf'", "authenticated", B) == 0
          and affected(f"delete from storage.objects where name = '{A}/f.pdf'", "authenticated", B) == 0)
    expect("storage: anon has no access", "42501", "select * from storage.objects", "anon")
    # NOTE: this validates the policy logic on a stub. Storage API behaviour (size/MIME limits,
    # signed URLs) must be tested against a real Supabase project with real users.


def t_cascades_and_deletion():
    seed()
    run(f"delete from subjects where id = '{rid(A, 'subjects')}'")
    t_subj = run(f"select subject_id is null from tasks where id = '{rid(A, 'tasks')}'").scalar()
    d_subj = run(f"select subject_id is null from documents where id = '{rid(A, 'documents')}'").scalar()
    check("cascade: deleting a subject keeps its tasks/documents and clears subject_id (live behaviour: SET NULL)",
          t_subj == "t" and d_subj == "t", f"task={t_subj} doc={d_subj}")
    seed()
    run(f"delete from documents where id = '{rid(A, 'documents')}'")
    left = {t: count(f"select 1 from {t} where user_id = '{A}'")
            for t in ("notes", "quizzes", "quiz_questions", "quiz_attempts")}
    left["question_keys"] = count(f"select 1 from private.question_keys where user_id = '{A}'")
    check("cascade: deleting a document removes notes, quizzes, questions, attempts and answer keys",
          all(v == 0 for v in left.values()), str(left))
    seed()
    before_b = {t: count(f"select 1 from {t} where {oc} = '{B}'") for t, oc in OWNER_COL.items()}
    before_b["question_keys"] = count(f"select 1 from private.question_keys where user_id = '{B}'")
    run(f"delete from auth.users where id = '{A}'")
    after_a = {t: count(f"select 1 from {t} where {oc} = '{A}'") for t, oc in OWNER_COL.items()}
    after_a["question_keys"] = count(f"select 1 from private.question_keys where user_id = '{A}'")
    after_b = {t: count(f"select 1 from {t} where {oc} = '{B}'") for t, oc in OWNER_COL.items()}
    after_b["question_keys"] = count(f"select 1 from private.question_keys where user_id = '{B}'")
    check("account deletion (DB part): zero rows left for the deleted user in every table",
          all(v == 0 for v in after_a.values()), str(after_a))
    check("account deletion (DB part): the other user's data is unchanged", before_b == after_b, f"{before_b} vs {after_b}")
    gap("account deletion: Storage objects are not removed by relational cascades",
        "needs an explicit server-side function + test against real Storage (SPEC §10)")


def t_spec_conformance():
    have = {r[0] for r in run("select table_name from information_schema.tables where table_schema='public'").rows}
    need = ["document_pages", "summaries", "usage_counters", "spend_counters", "usage_limits", "credit_costs", "app_config"]
    missing = [t for t in need if t not in have]
    if missing:
        gap("SPEC §5.4/§9 tables missing", ", ".join(missing))

    def cols(t):
        return {r[0] for r in run(f"select column_name from information_schema.columns where table_schema='public' and table_name='{t}'").rows}

    for table, wanted in {
        "ai_usage_log": ["request_key", "status", "credits_reserved", "credits_charged", "result_ref", "prompt_version"],
        "documents": ["sha256", "page_count", "kind", "failed_reason", "attempts", "locked_at", "processed_at"],
        "subjects": ["exam_date"], "tasks": ["note"],
    }.items():
        miss = [c for c in wanted if c not in cols(table)]
        if miss:
            gap(f"SPEC columns missing on {table}", ", ".join(miss))
    pol = count("select 1 from pg_policies where schemaname='storage' and cmd in ('INSERT','UPDATE','DELETE') and policyname like 'documents_%'")
    if pol:
        gap("storage: clients can upload/overwrite/delete their own objects directly", f"{pol} write policies; SPEC §5.2 says server-only via signed URLs, so server-side page/size/dedup checks can be bypassed")
    gap("storage: bucket size limit is 50 MB", "SPEC start value is 20 MB (configurable); decide and align")
    if "notes" in have:
        gap("notes table exists", "Mini Notebook is outside V1 scope; do not build UI until approved")
    gap("profiles key is 'id' (SPEC says user_id) and has no plan / deletion_requested_at", "naming + needed for plan limits and account deletion")
    gap("deleting a subject keeps tasks/documents (SET NULL) while SPEC §5.4 says cascade", "live behaviour is arguably safer; align the SPEC or the DB")


def main():
    for fn in (t_read_isolation, t_write_isolation, t_composite_fk, t_anon_and_server_only, t_quiz_security,
               t_profiles_and_trigger, t_constraints, t_storage_policies, t_cascades_and_deletion, t_spec_conformance):
        print(f"\n== {fn.__name__}")
        fn()
    fails = [r for r in results if r[1] == "FAIL"]
    gaps = [r for r in results if r[1] == "GAP"]
    passed = [r for r in results if r[1] == "PASS"]
    print(f"\n{len(passed)} passed, {len(fails)} failed, {len(gaps)} gaps (informational)")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
