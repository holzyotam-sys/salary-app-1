export type ChildInfo = {
  id: string;
  birthDate: string; // YYYY-MM-DD
};

export type Form101Data = {
  gender: "male" | "female";
  maritalStatus: "single" | "married" | "divorced" | "widowed";
  israelResident: boolean;
  spouseWorks: boolean;
  spouseMonthlyIncome: number;
  singleParent: boolean;
  childrenLivingWith: "me" | "other" | "shared";
  childPointsReceiver: "me" | "spouse" | "split";
  paysAlimony: boolean;
  alimonyAmount: number;
  children: ChildInfo[];
  pensionPercent: number;
  trainingFundPercent: number;
};

export function createEmptyForm101(): Form101Data {
  return {
    gender: "male",
    maritalStatus: "single",
    israelResident: true,
    spouseWorks: false,
    spouseMonthlyIncome: 0,
    singleParent: false,
    childrenLivingWith: "me",
    childPointsReceiver: "me",
    paysAlimony: false,
    alimonyAmount: 0,
    children: [],
    pensionPercent: 6,
    trainingFundPercent: 2.5,
  };
}

function getAgeOnDate(birthDate: string, onDate = new Date()): number {
  if (!birthDate) return 0;

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;

  let age = onDate.getFullYear() - birth.getFullYear();
  const monthDiff = onDate.getMonth() - birth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && onDate.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age;
}

function calculateChildrenCreditPoints(form: Form101Data, today = new Date()): number {
  let points = 0;

  if (form.childPointsReceiver === "spouse") {
    return 0;
  }

  for (const child of form.children) {
    const age = getAgeOnDate(child.birthDate, today);

    if (age < 0) continue;

    if (age <= 5) {
      points += 1.5;
    } else if (age <= 17) {
      points += 1;
    }
  }

  if (form.childPointsReceiver === "split") {
    points = points / 2;
  }

  if (form.singleParent && form.children.length > 0) {
    points += 1;
  }

  if (
    form.maritalStatus === "divorced" &&
    form.children.length > 0 &&
    form.childrenLivingWith === "other" &&
    form.childPointsReceiver === "me"
  ) {
    points = points * 0.5;
  }

  return points;
}

export function calculateCreditPoints(form: Form101Data, today = new Date()): number {
  let points = 0;

  if (form.israelResident) {
    points += 2.25;
  }

  if (form.gender === "female") {
    points += 0.5;
  }

  if (
    form.maritalStatus === "married" &&
    !form.spouseWorks &&
    form.children.length > 0
  ) {
    points += 1;
  }

  points += calculateChildrenCreditPoints(form, today);

  return Number(points.toFixed(2));
}

export function buildTrackerProfile(form: Form101Data) {
  return {
    creditPoints: calculateCreditPoints(form),
    pensionPercent: form.pensionPercent,
    trainingFundPercent: form.trainingFundPercent,
  };
}