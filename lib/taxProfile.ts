export type ChildInfo = {
  id: string;
  birthYear: number;
};

export type Form101Data = {
  gender: "male" | "female";
  maritalStatus: "single" | "married" | "divorced" | "widowed";
  israelResident: boolean;
  spouseWorks: boolean;
  singleParent: boolean;
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
    singleParent: false,
    children: [],
    pensionPercent: 6,
    trainingFundPercent: 2.5,
  };
}

export function calculateCreditPoints(form: Form101Data, currentYear = new Date().getFullYear()) {
  let points = 0;

  if (form.israelResident) {
    points += 2.25;
  }

  if (form.gender === "female") {
    points += 0.5;
  }

  if (form.singleParent) {
    points += 1;
  }

  if (
    form.maritalStatus === "married" &&
    !form.spouseWorks &&
    form.children.length > 0
  ) {
    points += 1;
  }

  for (const child of form.children) {
    const age = currentYear - child.birthYear;

    if (age < 0) continue;

    if (age <= 5) {
      points += 1.5;
    } else if (age <= 17) {
      points += 1;
    }
  }

  return Number(points.toFixed(2));
}

export function buildTrackerProfile(form: Form101Data) {
  return {
    creditPoints: calculateCreditPoints(form),
    pensionPercent: form.pensionPercent,
    trainingFundPercent: form.trainingFundPercent,
  };
}