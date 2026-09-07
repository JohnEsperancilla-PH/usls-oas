export const VALID_IDS = [
  "Company ID",
  "Student / School ID",
  "Passport",
  "National ID",
  "SSS ID or SSS UMID Card",
  "GSIS ID or GSIS UMID Card",
  "Driver's License",
  "PRC ID",
  "OWWA ID (Overseas Workers Welfare Administration)",
  "iDOLE Card (Department of Labor and Employment)",
  "Voter's ID (COMELEC)",
  "Firearms License (PNP)",
  "Senior Citizen ID",
  "Persons with Disabilities (PWD) ID",
  "NBI Clearance",
  "Alien Cert/Immigrant Cert of Registration",
  "PhilHealth ID",
  "Government Office or GOCC ID",
  "Integrated Bar of the Philippines (IBP) ID",
  "TIN ID",
  "Postal ID",
  "Police Clearance",
  "Barangay Clearance",
] as const;

export type ValidId = (typeof VALID_IDS)[number];

export function isValidId(value: string): value is ValidId {
  return (VALID_IDS as readonly string[]).includes(value);
}