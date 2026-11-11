-- Reservations that never settle (server crash, timeout) are refunded by private.sweep_stuck_reservations,
-- but nothing was calling it. Run it every 5 minutes. The sweep is idempotent and uses skip locked, so overlapping runs are harmless.
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'sweep-stuck-reservations';
select cron.schedule('sweep-stuck-reservations', '*/5 * * * *', $$select private.sweep_stuck_reservations(100)$$);
