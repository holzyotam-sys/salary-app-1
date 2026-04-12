export type TaxProfile = {
  creditPoints: number;
  pensionPercent: number;
  trainingFundPercent: number;
};

const TAX_BRACKETS = [
  { limit: 7010, rate: 0.1 },
  { limit: 10060, rate: 0.14 },
  { limit: 16150, rate: 0.2 },
  { limit: 22440, rate: 0.31 },
  { limit: 46690, rate: 0.35 },
  { limit: Infinity, rate: 0.47 },
];

const CREDIT_POINT_VALUE = 235;

export function calculateIncomeTax(salary: number, creditPoints: number) {
  let remaining = salary;
  let tax = 0;
  let prevLimit = 0;

  for (const bracket of TAX_BRACKETS) {
    const taxable = Math.min(remaining, bracket.limit - prevLimit);
    if (taxable <= 0) break;

    tax += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = bracket.limit;
  }

  const credits = creditPoints * CREDIT_POINT_VALUE;
  return Math.max(0, tax - credits);
}

export function calculateBituachLeumi(salary: number) {
  const lowRate = 0.035;
  const highRate = 0.12;
  const threshold = 7522;

  if (salary <= threshold) {
    return salary * lowRate;
  }

  return threshold * lowRate + (salary - threshold) * highRate;
}

export function calculateNetSalary(gross: number, profile: TaxProfile) {
  const incomeTax = calculateIncomeTax(gross, profile.creditPoints);
  const bituach = calculateBituachLeumi(gross);
  const pension = gross * (profile.pensionPercent / 100);
  const training = gross * (profile.trainingFundPercent / 100);

  const totalDeductions = incomeTax + bituach + pension + training;

  return {
    gross,
    incomeTax,
    bituach,
    pension,
    training,
    net: gross - totalDeductions,
  };
}