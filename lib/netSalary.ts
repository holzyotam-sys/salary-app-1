export function calculateBituachLeumi(salary: number) {
  const lowRate = 0.035;
  const highRate = 0.12;

  const threshold = 7522;

  if (salary <= threshold) {
    return salary * lowRate;
  }

  return (
    threshold * lowRate +
    (salary - threshold) * highRate
  );
}