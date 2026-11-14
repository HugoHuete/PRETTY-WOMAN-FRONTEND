export function dateWithCurrentManaguaTime(date: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Managua', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '00';
  return new Date(`${date}T${part('hour')}:${part('minute')}:${part('second')}-06:00`).toISOString();
}
