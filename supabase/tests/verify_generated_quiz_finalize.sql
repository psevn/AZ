-- Disposable PostgreSQL integration test for the generated-quiz persistence/settlement transaction.
-- The runner applies the proposal files to this throwaway database only.
begin;

insert into public.app_config(key, value)
values (
  'document_limits',
  jsonb_build_object(
    'free', jsonb_build_object('max_documents', 100, 'max_pages', 100, 'max_text_chars', 1000000, 'max_active_uploads', 10, 'stale_uploaded_minutes', 30),
    'pro', jsonb_build_object('max_documents', 100, 'max_pages', 100, 'max_text_chars', 1000000, 'max_active_uploads', 10, 'stale_uploaded_minutes', 30)
  )
)
on conflict (key) do update set value = excluded.value;
update public.usage_limits set daily_credits = 1000, monthly_credits = 10000 where plan = 'free';
insert into public.credit_costs(feature, credits) values ('generate_quiz', 1)
on conflict (feature) do update set credits = excluded.credits;
update public.app_config set value = '100'::jsonb where key = 'global_monthly_cost_cap';

insert into auth.users(id,email) values
  ('a4444444-4444-4444-8444-444444444444','quiz-finalize-owner@example.invalid'),
  ('a5555555-5555-4555-8555-555555555555','quiz-finalize-other@example.invalid');
insert into public.profiles(id,plan) values
  ('a4444444-4444-4444-8444-444444444444','free'),
  ('a5555555-5555-4555-8555-555555555555','free')
on conflict (id) do update set plan='free';

insert into public.documents(id,user_id,title,storage_path,status,kind) values
  ('b4444444-4444-4444-8444-444444444444','a4444444-4444-4444-8444-444444444444','Owner PDF','a4444444-4444-4444-8444-444444444444/owner.pdf','ready','other'),
  ('b5555555-5555-4555-8555-555555555555','a5555555-5555-4555-8555-555555555555','Other PDF','a5555555-5555-4555-8555-555555555555/other.pdf','ready','other');
insert into public.document_pages(user_id,document_id,page_no,text) values
  ('a4444444-4444-4444-8444-444444444444','b4444444-4444-4444-8444-444444444444',1,'Demand rises when buyers want more goods.'),
  ('a5555555-5555-4555-8555-555555555555','b5555555-5555-4555-8555-555555555555',1,'A different user document page.');

set local role service_role;

do $quiz_finalize_test$
declare
  v_reservation record;
  v_completed record;
  v_status text;
  v_tokens text;
  v_questions jsonb := jsonb_build_array(
    jsonb_build_object('prompt','What happens when demand rises?','choices',jsonb_build_array('Price rises','Price falls','No change','Supply vanishes'),'correct_index',0,'source_page',1,'topic','Demand','explanation','The supplied page says demand rises.','difficulty',1),
    jsonb_build_object('prompt','Which factor describes demand?','choices',jsonb_build_array('Buyer willingness','Factory rent','Tax rate','Machine age'),'correct_index',0,'source_page',1,'topic','Demand','explanation','The supplied page discusses buyers.','difficulty',1),
    jsonb_build_object('prompt','What do buyers want more of?','choices',jsonb_build_array('Goods','Taxes','Factories','Machines'),'correct_index',0,'source_page',1,'topic','Demand','explanation','The supplied page refers to goods.','difficulty',1),
    jsonb_build_object('prompt','Which curve concept is discussed?','choices',jsonb_build_array('Demand','Depreciation','Liquidity','Inflation'),'correct_index',0,'source_page',1,'topic','Demand','explanation','The supplied page is about demand.','difficulty',1),
    jsonb_build_object('prompt','What changes buyer demand?','choices',jsonb_build_array('Buyer preference','Factory size','Machine age','Office rent'),'correct_index',0,'source_page',1,'topic','Demand','explanation','The supplied page grounds the question in buyer demand.','difficulty',1)
  );
begin
  select * into v_reservation
    from public.reserve_credits(
      'a4444444-4444-4444-8444-444444444444',
      'generate_quiz',
      'atomic-finalize-key',
      0.01,
      1
    );
  if v_reservation.r_status <> 'reserved' then
    raise exception 'Quiz reservation failed: %', row_to_json(v_reservation);
  end if;

  select * into v_completed
    from public.complete_generated_quiz(
      'a4444444-4444-4444-8444-444444444444',
      'b4444444-4444-4444-8444-444444444444',
      'Owner PDF',
      'atomic-finalize-key',
      v_questions,
      0.001,
      'openai',
      'test-model',
      'quiz-v1',
      100,
      12,
      40
    );

  if v_completed.quiz_id is null
     or v_completed.result_payload->>'quizId' <> v_completed.quiz_id::text
     or jsonb_array_length(v_completed.questions) <> 5 then
    raise exception 'Atomic quiz finalization returned an invalid safe result: %', row_to_json(v_completed);
  end if;

  select status, input_tokens || '|' || output_tokens
    into v_status, v_tokens
    from public.ai_usage_log
   where user_id = 'a4444444-4444-4444-8444-444444444444'
     and feature = 'generate_quiz'
     and request_key = 'atomic-finalize-key';
  if v_status <> 'succeeded' or v_tokens <> '12|40' then
    raise exception 'Quiz billing was not committed with token usage: status=% tokens=%', v_status, v_tokens;
  end if;

  -- A service-role call with an owner ID and another user's document must fail.
  select * into v_reservation
    from public.reserve_credits(
      'a4444444-4444-4444-8444-444444444444',
      'generate_quiz',
      'cross-owner-key',
      0.01,
      1
    );
  begin
    perform * from public.complete_generated_quiz(
      'a4444444-4444-4444-8444-444444444444',
      'b5555555-5555-4555-8555-555555555555',
      'Other PDF',
      'cross-owner-key',
      v_questions,
      0.001,
      'openai',
      'test-model',
      'quiz-v1',
      100,
      12,
      40
    );
    raise exception 'Cross-user document was accepted by generated quiz persistence';
  exception when sqlstate 'P0002' then
    null;
  end;
  perform public.refund_credits(
    'a4444444-4444-4444-8444-444444444444',
    'generate_quiz',
    'cross-owner-key',
    'cross_user_document_rejected'
  );
end;
$quiz_finalize_test$;

rollback;
