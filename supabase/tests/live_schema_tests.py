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
            quiz_questions=7, quiz_attempts=8, ai_usage_log=9, attempt_answers=10,
            document_pages=11, summaries=12, flashcards=13, attempt_questions=14)

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
        s, t, f, d, n, q, qq, at, lg, aa, dp, sm, fc, aq = (rid(u, k) for k in
                                        ("subjects", "tasks", "focus_sessions", "documents", "notes", "quizzes",
                                         "quiz_questions", "quiz_attempts", "ai_usage_log", "attempt_answers",
                                         "document_pages", "summaries", "flashcards", "attempt_questions"))
        sql += [
            f"insert into subjects (id,user_id,name) values ('{s}','{u}','subj');",
            f"insert into tasks (id,user_id,subject_id,title) values ('{t}','{u}','{s}','task');",
            f"insert into focus_sessions (id,user_id,task_id) values ('{f}','{u}','{t}');",
            f"insert into documents (id,user_id,subject_id,title,storage_path) values ('{d}','{u}','{s}','doc','{u}/doc.pdf');",
            f"insert into notes (id,user_id,document_id,body) values ('{n}','{u}','{d}','note');",
            f"insert into quizzes (id,user_id,document_id) values ('{q}','{u}','{d}');",
            f"insert into quiz_questions (id,user_id,quiz_id,prompt,choices) values ('{qq}','{u}','{q}','q?','[\"x\",\"y\",\"z\"]');",
            f"insert into private.question_keys (question_id,user_id,correct_index,explanation) values ('{qq}','{u}',1,'because');",
            f"insert into quiz_attempts (id,user_id,quiz_id) values ('{at}','{u}','{q}');",
            f"insert into attempt_questions (id,user_id,attempt_id,question_id,position_no) values ('{aq}','{u}','{at}','{qq}',1);",
            f"insert into attempt_answers (id,user_id,attempt_id,question_id,chosen_index,is_correct) values ('{aa}','{u}','{at}','{qq}',0,false);",
            f"insert into flashcards (id,user_id,document_id,front,back,source_page,topic) values ('{fc}','{u}','{d}','front','back',1,'t1');",
            f"insert into flashcard_progress (user_id,flashcard_id,status) values ('{u}','{fc}','known');",
            f"insert into ai_usage_log (id,user_id,feature,model,request_key) values ('{lg}','{u}','quiz','m','seed-key');",
            f"insert into document_pages (id,user_id,document_id,page_no,text) values ('{dp}','{u}','{d}',1,'p1');",
            f"insert into summaries (id,user_id,document_id,content) values ('{sm}','{u}','{d}','sum');",
            f"insert into usage_counters (user_id,period_type,period_start,credits_used) values ('{u}','day',current_date,0);",
        ]
    r = run(" ".join(sql))
    if not r.ok:
        print("SEED FAILED:", r.err)
        sys.exit(2)


OWNER_COL = {"profiles": "id", "subjects": "user_id", "tasks": "user_id", "focus_sessions": "user_id",
             "notes": "user_id", "documents": "user_id", "quizzes": "user_id", "quiz_questions": "user_id",
             "quiz_attempts": "user_id", "ai_usage_log": "user_id", "attempt_answers": "user_id",
             "document_pages": "user_id", "summaries": "user_id", "flashcards": "user_id",
             "attempt_questions": "user_id"}
WRITABLE = ["subjects", "tasks", "focus_sessions", "notes"]
READ_ONLY = ["documents", "quizzes", "quiz_questions", "quiz_attempts", "ai_usage_log", "attempt_answers",
             "document_pages", "summaries", "flashcards", "attempt_questions"]
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
           f"insert into ai_usage_log (user_id,feature,model,request_key) values ('{A}','x','m','k')", "authenticated", A)
    for tbl in ("document_pages", "summaries", "attempt_answers"):
        expect(f"write: owner cannot insert {tbl} directly", "42501",
               f"insert into {tbl} (user_id) values ('{A}')", "authenticated", A)
    expect("write: owner cannot insert usage_counters directly", "42501",
           f"insert into usage_counters (user_id,period_type,period_start) values ('{A}','day',current_date)", "authenticated", A)
    expect("write: owner cannot write flashcard_progress directly", "42501",
           f"insert into flashcard_progress (user_id,flashcard_id,status) values ('{A}','{rid(A, 'flashcards')}','known')", "authenticated", A)
    expect("write: owner cannot edit flashcard content", "42501",
           f"update flashcards set back = 'x' where user_id = '{A}'", "authenticated", A)
    expect("write: owner cannot raise own credits_used", "42501",
           f"update usage_counters set credits_used = 0 where user_id = '{A}'", "authenticated", A)
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
        "attempt -> A's quiz": f"insert into quiz_attempts (user_id,quiz_id) values ('{B}','{rid(A, 'quizzes')}')",
        "attempt answer -> A's attempt": f"insert into attempt_answers (user_id,attempt_id,question_id,chosen_index,is_correct) values ('{B}','{rid(A, 'quiz_attempts')}','{rid(B, 'quiz_questions')}',0,false)",
        "attempt answer -> A's question": f"insert into attempt_answers (user_id,attempt_id,question_id,chosen_index,is_correct) values ('{B}','{rid(B, 'quiz_attempts')}','{rid(A, 'quiz_questions')}',0,false)",
        "document page -> A's document": f"insert into document_pages (user_id,document_id,page_no) values ('{B}','{rid(A, 'documents')}',9)",
        "flashcard -> A's document": f"insert into flashcards (user_id,document_id,front,back) values ('{B}','{rid(A, 'documents')}','f','b')",
        "flashcard progress -> A's flashcard": f"insert into flashcard_progress (user_id,flashcard_id,status) values ('{B}','{rid(A, 'flashcards')}','known')",
        "attempt question -> A's question": f"insert into attempt_questions (user_id,attempt_id,question_id,position_no) values ('{B}','{rid(B, 'quiz_attempts')}','{rid(A, 'quiz_questions')}',2)",
        "attempt question -> A's attempt": f"insert into attempt_questions (user_id,attempt_id,question_id,position_no) values ('{B}','{rid(A, 'quiz_attempts')}','{rid(B, 'quiz_questions')}',2)",
        "summary -> A's document": f"insert into summaries (user_id,document_id,content) values ('{B}','{rid(A, 'documents')}','x')",
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
           f"select * from public.submit_answer('{rid(A, 'quiz_attempts')}'::uuid, '{rid(A, 'quiz_questions')}'::uuid, 1::smallint)", "anon")
    expect("anon: cannot run start_attempt", "42501", f"select * from public.start_attempt('{rid(A, 'quizzes')}'::uuid)", "anon")
    expect("anon: cannot run finish_attempt", "42501", f"select * from public.finish_attempt('{rid(A, 'quiz_attempts')}'::uuid)", "anon")
    # The public wrappers are SECURITY INVOKER, so `authenticated` must be able to reach the private
    # functions (same pattern as the original RPC). That is safe only because they check auth.uid() themselves:
    expect("private fn: B calling private.start_attempt on A's quiz -> not found (P0002)", "P0002",
           f"select * from private.start_attempt('{rid(A, 'quizzes')}'::uuid)", "authenticated", B)
    expect("private fn: B calling private.finish_attempt on A's attempt -> not found (P0002)", "P0002",
           f"select * from private.finish_attempt('{rid(A, 'quiz_attempts')}'::uuid)", "authenticated", B)
    expect("private fn: anon cannot call private.start_attempt", "42501",
           f"select * from private.start_attempt('{rid(A, 'quizzes')}'::uuid)", "anon")
    for t in ("spend_counters", "app_config"):
        expect(f"server-only: authenticated cannot read {t}", "42501", f"select * from {t}", "authenticated", A)
    expect("server-only: authenticated cannot write usage_limits", "42501", "update usage_limits set daily_credits = 999", "authenticated", A)
    expect("server-only: authenticated cannot write credit_costs", "42501", "insert into credit_costs values ('x', 0)", "authenticated", A)
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
    for t in ("quiz_questions", "attempt_answers"):
        pass
    cols = run("select column_name from information_schema.columns where table_schema='public' and table_name='quiz_questions'")
    leak = {r[0] for r in cols.rows} & {"correct_index", "correct_option", "explanation", "answer", "is_correct"}
    check("quiz: quiz_questions has no answer columns", not leak, f"leak={leak}")
    old = count("select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='submit_answer' and p.pronargs=2")
    check("quiz: old 2-arg submit_answer is gone", old == 0, f"old={old}")
    q, qz = rid(A, "quiz_questions"), rid(A, "quizzes")

    def start(user, quiz):
        r = run(f"select attempt_id from public.start_attempt('{quiz}'::uuid)", "authenticated", user)
        return r, (r.scalar() if r.ok else None)

    r, att = start(A, qz)
    check("attempt: owner can start an attempt (positive control)", r.ok and att, r.err[:150])
    expect("attempt: B cannot start an attempt on A's quiz (P0002)", "P0002",
           f"select * from public.start_attempt('{qz}'::uuid)", "authenticated", B)
    expect("attempt: unauthenticated start rejected (28000)", "28000",
           f"select * from public.start_attempt('{qz}'::uuid)", "authenticated")
    expect("attempt: null quiz rejected (22023)", "22023", "select * from public.start_attempt(null)", "authenticated", A)

    sub = lambda a, qq, i, u=A: run(f"select is_correct, correct_index, explanation from public.submit_answer('{a}'::uuid,'{qq}'::uuid,{i}::smallint)", "authenticated", u)
    r = sub(att, q, 1)
    check("quiz: correct answer graded server-side, key revealed only after submit",
          r.ok and r.rows and r.rows[0][:3] == ["t", "1", "because"], f"{r.rows} {r.err[:120]}")
    expect("quiz: same question twice in one attempt rejected (23505)", "23505",
           f"select * from public.submit_answer('{att}'::uuid,'{q}'::uuid,0::smallint)", "authenticated", A)
    check("quiz: duplicate attempt did not change the stored answer",
          run(f"select is_correct from attempt_answers where attempt_id='{att}' and question_id='{q}'").scalar() == "t")
    expect("quiz: B cannot answer inside A's attempt (P0002)", "P0002",
           f"select * from public.submit_answer('{att}'::uuid,'{q}'::uuid,1::smallint)", "authenticated", B)
    expect("quiz: question from another quiz of the same user rejected (P0002)", "P0002",
           f"select * from public.submit_answer('{att}'::uuid,'{rid(B, 'quiz_questions')}'::uuid,1::smallint)", "authenticated", A)
    expect("quiz: unauthenticated submit rejected (28000)", "28000",
           f"select * from public.submit_answer('{att}'::uuid,'{q}'::uuid,1::smallint)", "authenticated")

    # second attempt: wrong answer, range checks
    r, att2 = start(A, qz)
    r = sub(att2, q, 0)
    check("quiz: wrong answer graded false", r.ok and r.rows and r.rows[0][0] == "f", f"{r.rows} {r.err[:120]}")
    r, att3 = start(A, qz)
    expect("quiz: index out of range rejected (22023)", "22023",
           f"select * from public.submit_answer('{att3}'::uuid,'{q}'::uuid,9::smallint)", "authenticated", A)
    expect("quiz: negative index rejected (22023)", "22023",
           f"select * from public.submit_answer('{att3}'::uuid,'{q}'::uuid,(-1)::smallint)", "authenticated", A)
    check("quiz: rejected inputs stored nothing",
          count(f"select 1 from attempt_answers where attempt_id='{att3}'") == 0)

    # finish: score, idempotency, locked afterwards
    r = run(f"select score, correct_count, total_questions from public.finish_attempt('{att}'::uuid)", "authenticated", A)
    check("finish: 1 of 1 correct -> score 100", r.ok and r.rows and r.rows[0][:3] == ["100.00", "1", "1"] or (r.ok and r.rows and r.rows[0][:3] == ["100", "1", "1"]), f"{r.rows} {r.err[:120]}")
    r = run(f"select score, correct_count from public.finish_attempt('{att2}'::uuid)", "authenticated", A)
    check("finish: wrong answer -> score 0", r.ok and r.rows and float(r.rows[0][0]) == 0 and r.rows[0][1] == "0", f"{r.rows} {r.err[:120]}")
    r = run(f"select score from public.finish_attempt('{att3}'::uuid)", "authenticated", A)
    check("finish: unanswered question counts as wrong (score 0)", r.ok and r.rows and float(r.rows[0][0]) == 0, f"{r.rows} {r.err[:120]}")
    f1 = run(f"select finished_at from quiz_attempts where id='{att}'").scalar()
    r = run(f"select score, finished_at from public.finish_attempt('{att}'::uuid)", "authenticated", A)
    check("finish: calling twice is idempotent (same score, same finished_at)",
          r.ok and float(r.rows[0][0]) == 100 and r.rows[0][1].replace("+00", "") == f1.replace("+00", ""), f"{r.rows} vs {f1}")
    expect("finish: submitting to a finished attempt rejected (55000)", "55000",
           f"select * from public.submit_answer('{att}'::uuid,'{q}'::uuid,1::smallint)", "authenticated", A)
    expect("finish: B cannot finish A's attempt (P0002)", "P0002",
           f"select * from public.finish_attempt('{att2}'::uuid)", "authenticated", B)
    expect("finish: unauthenticated rejected (28000)", "28000",
           f"select * from public.finish_attempt('{att2}'::uuid)", "authenticated")
    check("attempt: B sees none of A's attempts or answers",
          count("select 1 from quiz_attempts where user_id = '%s'" % A, "authenticated", B) == 0
          and count("select 1 from attempt_answers where user_id = '%s'" % A, "authenticated", B) == 0)
    check("attempt: A sees own attempts (seed 1 + 3 started) and answers (seed 1 + 2)",
          count("select 1 from quiz_attempts", "authenticated", A) == 4
          and count("select 1 from attempt_answers", "authenticated", A) == 3)
    expect("attempt: client cannot forge an attempt row", "42501",
           f"insert into quiz_attempts (user_id,quiz_id,score) values ('{A}','{qz}',100)", "authenticated", A)
    expect("attempt: client cannot edit own score", "42501",
           f"update quiz_attempts set score = 100 where id = '{att3}'", "authenticated", A)
    expect("attempt: client cannot forge an answer", "42501",
           f"insert into attempt_answers (user_id,attempt_id,question_id,chosen_index,is_correct) values ('{A}','{att3}','{q}',1,true)", "authenticated", A)
    expect("attempt: client cannot flip is_correct", "42501",
           f"update attempt_answers set is_correct = true where user_id = '{A}'", "authenticated", A)
    expect("attempt: score range constraint (23514)", "23514",
           f"update quiz_attempts set score = 101 where id = '{att3}'", "service_role")

def t_exam_mode_and_flashcards():
    seed()
    q1, qz = rid(A, "quiz_questions"), rid(A, "quizzes")
    # second question in A's quiz (server side) so an exam can use a subset
    run(f"insert into quiz_questions (id,user_id,quiz_id,prompt,choices,source_page,topic,difficulty) values "
        f"('aaaaaaaa-0000-0000-0000-000000000099','{A}','{qz}','q2?','[\"x\",\"y\"]',3,'topic-2',2);"
        f"insert into private.question_keys (question_id,user_id,correct_index,explanation) values "
        f"('aaaaaaaa-0000-0000-0000-000000000099','{A}',0,'because 2');", "service_role")
    q2 = "aaaaaaaa-0000-0000-0000-000000000099"

    # input validation
    expect("exam: unknown mode rejected (22023)", "22023", f"select * from public.start_attempt('{qz}'::uuid,'quiz')", "authenticated", A)
    expect("exam: time limit on a practice attempt rejected (22023)", "22023",
           f"select * from public.start_attempt('{qz}'::uuid,'practice',null,600)", "authenticated", A)
    expect("exam: time limit under 60 s rejected (22023)", "22023",
           f"select * from public.start_attempt('{qz}'::uuid,'exam',null,10)", "authenticated", A)
    expect("exam: question count 0 rejected (22023)", "22023",
           f"select * from public.start_attempt('{qz}'::uuid,'exam',0,600)", "authenticated", A)
    expect("exam: B cannot start an exam on A's quiz (P0002)", "P0002",
           f"select * from public.start_attempt('{qz}'::uuid,'exam',1,600)", "authenticated", B)

    r = run(f"select attempt_id, question_count, deadline is not null from public.start_attempt('{qz}'::uuid,'exam',1,600)", "authenticated", A)
    check("exam: starts with 1 of 2 questions and a server deadline", r.ok and r.rows[0][1] == "1" and r.rows[0][2] == "t", f"{r.rows} {r.err[:120]}")
    att = r.rows[0][0]
    n = count(f"select 1 from attempt_questions where attempt_id='{att}'")
    check("exam: attempt stores exactly its own question set (1 row)", n == 1, f"n={n}")
    inside = run(f"select question_id from attempt_questions where attempt_id='{att}'").scalar()
    outside = q2 if inside == q1 else q1
    expect("exam: a question outside the attempt's set is rejected (P0002)", "P0002",
           f"select * from public.submit_answer('{att}'::uuid,'{outside}'::uuid,0::smallint)", "authenticated", A)

    sub = lambda qq, i, a=att, u=A: run(f"select is_correct, correct_index, explanation from public.submit_answer('{a}'::uuid,'{qq}'::uuid,{i}::smallint)", "authenticated", u)
    right = 1 if inside == q1 else 0
    wrong = 0 if right == 1 else 1
    r = sub(inside, wrong)
    check("exam: submitting reveals nothing (no correctness, key or explanation)", r.ok and r.rows and r.rows[0][:3] == ["", "", ""], f"{r.rows} {r.err[:120]}")
    r = sub(inside, right)
    check("exam: the answer can be changed before finishing", r.ok, r.err[:120])
    check("exam: only the final answer is stored (1 row, correct)",
          run(f"select count(*)||'/'||bool_and(is_correct) from attempt_answers where attempt_id='{att}'").scalar() == "1/true")
    expect("exam: review before finishing rejected (55000)", "55000",
           f"select * from public.get_attempt_review('{att}'::uuid)", "authenticated", A)
    r = run(f"select score, correct_count, total_questions from public.finish_attempt('{att}'::uuid)", "authenticated", A)
    check("exam: score counts only the attempt's own questions (1 of 1 -> 100)", r.ok and float(r.rows[0][0]) == 100 and r.rows[0][2] == "1", f"{r.rows} {r.err[:120]}")
    r = run(f"select r_correct_index, r_explanation, r_source_page, r_topic, r_is_correct from public.get_attempt_review('{att}'::uuid)", "authenticated", A)
    check("review: after finishing shows key, explanation, source page, topic", r.ok and len(r.rows) == 1 and r.rows[0][0] == str(1 if inside == q1 else 0)
          and r.rows[0][4] == "t", f"{r.rows} {r.err[:120]}")
    expect("review: B cannot read A's review (P0002)", "P0002", f"select * from public.get_attempt_review('{att}'::uuid)", "authenticated", B)
    expect("review: anon denied", "42501", f"select * from public.get_attempt_review('{att}'::uuid)", "anon")
    expect("review: unauthenticated rejected (28000)", "28000", f"select * from public.get_attempt_review('{att}'::uuid)", "authenticated")
    expect("exam: answers rejected after finishing (55000)", "55000", f"select * from public.submit_answer('{att}'::uuid,'{inside}'::uuid,0::smallint)", "authenticated", A)

    # unanswered questions in a full exam count as wrong; review lists all of them
    r = run(f"select attempt_id, question_count from public.start_attempt('{qz}'::uuid,'exam',null,null)", "authenticated", A)
    att2 = r.rows[0][0]
    check("exam: no count given -> all questions", r.rows[0][1] == "2")
    sub(q1, 1, att2)
    r = run(f"select score, total_questions from public.finish_attempt('{att2}'::uuid)", "authenticated", A)
    check("exam: 1 correct of 2 -> 50", r.ok and float(r.rows[0][0]) == 50 and r.rows[0][1] == "2", f"{r.rows}")
    r = run(f"select count(*), count(r_chosen_index) from public.get_attempt_review('{att2}'::uuid)", "authenticated", A)
    check("review: lists all questions incl. unanswered (2 rows, 1 answered)", r.ok and r.rows[0] == ["2", "1"], str(r.rows))
    check("exam: count larger than available is clamped to what exists",
          run(f"select question_count from public.start_attempt('{qz}'::uuid,'exam',99,600)", "authenticated", A).scalar() == "2")

    # server-side timer
    r = run(f"select attempt_id from public.start_attempt('{qz}'::uuid,'exam',1,60)", "authenticated", A)
    att3 = r.rows[0][0]
    inside3 = run(f"select question_id from attempt_questions where attempt_id='{att3}'").scalar()
    run(f"update quiz_attempts set started_at = now() - interval '2 minutes' where id='{att3}'", "service_role")
    rr = run(f"select * from public.submit_answer('{att3}'::uuid,'{inside3}'::uuid,0::smallint)", "authenticated", A)
    check("timer: an answer after the deadline is rejected by the server (55000 Time is up)", (not rr.ok) and rr.state == "55000" and "Time is up" in rr.err, f"{rr.state} {rr.err[:100]}")
    r = run(f"select score, correct_count from public.finish_attempt('{att3}'::uuid)", "authenticated", A)
    check("timer: finishing after the deadline is still allowed (unanswered = 0)", r.ok and float(r.rows[0][0]) == 0, f"{r.rows} {r.err[:100]}")
    run(f"insert into quiz_attempts (id,user_id,quiz_id,mode,time_limit_seconds) values (gen_random_uuid(),'{A}','{qz}','exam',60)", "service_role")
    expect("constraint: time limit only allowed on exam attempts (23514)", "23514",
           f"update quiz_attempts set mode='practice' where user_id='{A}' and time_limit_seconds=60", "service_role")

    # practice mode unchanged: reveals per answer, no change allowed
    r = run(f"select attempt_id from public.start_attempt('{qz}'::uuid)", "authenticated", A)
    att4 = r.rows[0][0]
    r = sub(q1, 1, att4)
    check("practice: still reveals correctness, key and explanation per answer", r.ok and r.rows[0][:3] == ["t", "1", "because"], f"{r.rows} {r.err[:100]}")
    expect("practice: changing an answer is rejected (23505)", "23505", f"select * from public.submit_answer('{att4}'::uuid,'{q1}'::uuid,0::smallint)", "authenticated", A)

    # question metadata constraints
    expect("question: short-answer type not enabled yet (23514)", "23514", f"update quiz_questions set question_type='short' where id='{q1}'", "service_role")
    expect("question: source_page must be >= 1 (23514)", "23514", f"update quiz_questions set source_page=0 where id='{q1}'", "service_role")
    expect("question: difficulty outside 1..3 rejected (23514)", "23514", f"update quiz_questions set difficulty=4 where id='{q1}'", "service_role")
    expect("document: language outside ar/en/mixed rejected (23514)", "23514", f"update documents set language='fr' where id='{rid(A, 'documents')}'", "service_role")

    # flashcards
    fc = rid(A, "flashcards")
    r = run(f"select r_status, r_review_count from public.mark_flashcard('{fc}'::uuid,'needs_review')", "authenticated", A)
    check("flashcards: owner can mark a card; review count increments", r.ok and r.rows[0] == ["needs_review", "2"], f"{r.rows} {r.err[:100]}")
    r = run(f"select r_status, r_review_count from public.mark_flashcard('{fc}'::uuid,'known')", "authenticated", A)
    check("flashcards: status updates, count keeps growing", r.ok and r.rows[0] == ["known", "3"], str(r.rows))
    expect("flashcards: B cannot mark A's card (P0002)", "P0002", f"select * from public.mark_flashcard('{fc}'::uuid,'known')", "authenticated", B)
    expect("flashcards: invalid status rejected (22023)", "22023", f"select * from public.mark_flashcard('{fc}'::uuid,'mastered')", "authenticated", A)
    expect("flashcards: anon denied", "42501", f"select * from public.mark_flashcard('{fc}'::uuid,'known')", "anon")
    expect("flashcards: unauthenticated rejected (28000)", "28000", f"select * from public.mark_flashcard('{fc}'::uuid,'known')", "authenticated")
    check("flashcards: B sees none of A's progress", count(f"select 1 from flashcard_progress where user_id='{A}'", "authenticated", B) == 0)
    check("flashcards: owner sees own progress", count("select 1 from flashcard_progress", "authenticated", A) == 1)
    expect("flashcards: private function not callable by anon", "42501", f"select * from private.mark_flashcard('{fc}'::uuid,'known')", "anon")


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

    expect("profiles: owner cannot self-upgrade plan to pro", "42501", f"update profiles set plan = 'pro' where id = '{A}'", "authenticated", A)
    expect("profiles: owner cannot set deletion_requested_at directly", "42501", f"update profiles set deletion_requested_at = now() where id = '{A}'", "authenticated", A)
    check("profiles: new users default to plan 'free'", run(f"select plan from profiles where id = '{A}'").scalar() == "free")
    check("profiles: owner can still read own plan", run("select plan from profiles", "authenticated", A).scalar() == "free")

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

    expect("constraint: document kind outside list rejected (23514)", "23514",
           f"update documents set kind = 'meme' where id = '{rid(A, 'documents')}'", "service_role")
    run(f"update documents set sha256 = 'abc' where id = '{rid(A, 'documents')}'", "service_role")
    expect("constraint: same sha256 for the same user rejected (23505)", "23505",
           f"insert into documents (user_id,title,storage_path,sha256) values ('{A}','d2','{A}/d2.pdf','abc')", "service_role")
    r = run(f"insert into documents (user_id,title,storage_path,sha256) values ('{B}','d2','{B}/d2.pdf','abc')", "service_role")
    check("constraint: same sha256 for a DIFFERENT user is allowed", r.ok, r.err)
    expect("constraint: profiles.plan outside list rejected (23514)", "23514",
           f"update profiles set plan = 'gold' where id = '{A}'", "service_role")
    expect("constraint: ai_usage_log (user, feature, request_key) is unique (23505)", "23505",
           f"insert into ai_usage_log (user_id,feature,request_key) values ('{A}','quiz','seed-key')", "service_role")
    expect("constraint: ai_usage_log status outside list rejected (23514)", "23514",
           f"update ai_usage_log set status = 'weird' where user_id = '{A}'", "service_role")
    expect("constraint: tasks.note longer than 5000 rejected (23514)", "23514",
           f"update tasks set note = repeat('x', 5001) where id = '{rid(A, 'tasks')}'", "service_role")
    expect("constraint: document_pages page_no must be >= 1 (23514)", "23514",
           f"update document_pages set page_no = 0 where user_id = '{A}'", "service_role")
    expect("constraint: usage_counters cannot go negative (23514)", "23514",
           f"update usage_counters set credits_used = -1 where user_id = '{A}'", "service_role")
    lim = run("select plan||':'||daily_credits||':'||monthly_credits from usage_limits order by plan").rows
    check("config: fail-closed defaults (free/pro = 0 credits)", lim == [["free:0:0"], ["pro:0:0"]], str(lim))
    cfg = run("select key||'='||value::text from app_config order by key").rows
    check("config: global spend cap defaults to 0 (AI off)", ["global_monthly_cost_cap=0"] in cfg, str(cfg))
    bl = run("select file_size_limit from storage.buckets where id='documents'").scalar()
    check("storage: bucket limit is 20 MB (SPEC start value)", bl == "20971520", str(bl))

    # ai_usage_log: column-limited client read
    ok = run("select id, feature, status, credits_charged from ai_usage_log", "authenticated", A)
    check("ai_usage_log: owner can read the safe columns (RLS works with column grants)", ok.ok and len(ok.rows) == 1, ok.err[:150])
    for c in ("request_key", "model", "provider", "error", "result_ref", "credits_reserved", "prompt_version"):
        expect(f"ai_usage_log: owner cannot read column {c}", "42501", f"select {c} from ai_usage_log", "authenticated", A)
    expect("ai_usage_log: select * denied for clients (forces explicit safe columns)", "42501", "select * from ai_usage_log", "authenticated", A)
    check("ai_usage_log: B sees none of A's log rows",
          count(f"select 1 from ai_usage_log where user_id = '{A}'", "authenticated", B) == 0)

def t_storage_policies():
    seed()
    run(f"insert into storage.objects (bucket_id,name) values ('documents','{A}/f.pdf')")  # as server
    expect("storage: owner can no longer upload directly (server-only)", "42501",
           f"insert into storage.objects (bucket_id,name) values ('documents','{A}/g.pdf')", "authenticated", A)
    check("storage: owner cannot list own objects directly (server-signed access only)",
          count(f"select 1 from storage.objects where name = '{A}/f.pdf'", "authenticated", A) == 0)
    check("storage: owner cannot update/delete own objects directly",
          affected(f"update storage.objects set name = name where name = '{A}/f.pdf'", "authenticated", A) == 0
          and affected(f"delete from storage.objects where name = '{A}/f.pdf'", "authenticated", A) == 0)
    check("storage: B cannot see A's object", count(f"select 1 from storage.objects where name = '{A}/f.pdf'", "authenticated", B) == 0)
    expect("storage: B cannot add an object under A's folder", "42501",
           f"insert into storage.objects (bucket_id,name) values ('documents','{A}/evil.pdf')", "authenticated", B)
    expect("storage: anon has no access", "42501", "select * from storage.objects", "anon")
    check("storage: no client policies remain for the documents bucket",
          count("select 1 from pg_policies where schemaname='storage' and policyname like 'documents_%'") == 0)
    # NOTE: stub-level. Signed upload/download and real size/MIME limits need a real Supabase test.

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
            for t in ("notes", "quizzes", "quiz_questions", "quiz_attempts", "attempt_answers", "document_pages", "summaries", "attempt_questions", "flashcards", "flashcard_progress")}
    left["question_keys"] = count(f"select 1 from private.question_keys where user_id = '{A}'")
    check("cascade: deleting a document removes notes, quizzes, questions, attempts, answers, pages, summaries and answer keys",
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
    check("account deletion (DB part): usage counters also removed",
          count(f"select 1 from usage_counters where user_id = '{A}'") == 0 and count(f"select 1 from usage_counters where user_id = '{B}'") == 1)
    gap("account deletion: Storage objects are not removed by relational cascades",
        "needs an explicit server-side function + test against real Storage (SPEC §10)")

def t_spec_conformance():
    gap("account/Storage: object deletion on account deletion is not a DB cascade", "server function + real-Storage test needed (SPEC §10)")
    gap("credits: real provider calls are not wired to reserve/settle yet", "RPCs and concurrency tests exist (credits_tests.py); the Edge Function that uses them is a later slice")
    gap("profiles key is 'id' (SPEC says user_id)", "naming only; accepted unless PSEVN prefers a rename")
    gap("deleting a subject keeps tasks/documents (SET NULL) while SPEC §5.4 says cascade", "recommend aligning the SPEC to SET NULL")
    gap("notes table kept (PSEVN decision 2026-11-05), no UI yet", "P2 / Mini Notebook candidate")

def main():
    for fn in (t_read_isolation, t_write_isolation, t_composite_fk, t_anon_and_server_only, t_quiz_security, t_exam_mode_and_flashcards,
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
