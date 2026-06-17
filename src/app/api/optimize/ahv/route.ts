import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import {
  computeAhvCouple,
  computeAhvPerson,
  contributionYearsFromAges,
  type AhvPersonInput,
} from "@/lib/optimize/ahv";
import { ahvSchema } from "@/lib/optimize/schemas";

type PersonRequest = {
  determiningAverageAnnualIncome: string;
  contributionYears?: number;
  entryAge?: number;
  referenceAge: number;
};

function toPersonInput(year: number, person: PersonRequest): AhvPersonInput {
  const contributionYears =
    person.contributionYears ??
    contributionYearsFromAges(year, person.entryAge ?? 21, person.referenceAge).contributionYears;
  return {
    year,
    determiningAverageAnnualIncome: person.determiningAverageAnnualIncome,
    contributionYears,
  };
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, ahvSchema);
    const year = new Date().getUTCFullYear();
    const person = toPersonInput(year, input.person);

    if (input.spouse) {
      const couple = computeAhvCouple(person, toPersonInput(year, input.spouse));
      return json({ kind: "couple", ...couple });
    }
    return json({ kind: "single", ...computeAhvPerson(person) });
  } catch (error) {
    return routeError(error);
  }
}
