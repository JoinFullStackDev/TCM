/** Fake-but-plausible values for the order randomizer. Nothing here is a real person. */

export const FIRST_NAMES_F = [
  'Avery', 'Brooke', 'Camila', 'Dana', 'Elena', 'Fiona', 'Grace', 'Hana', 'Iris', 'Jade',
  'Kira', 'Lena', 'Maya', 'Nora', 'Olive', 'Priya', 'Quinn', 'Rosa', 'Sofia', 'Tessa',
];

export const FIRST_NAMES_M = [
  'Aaron', 'Blake', 'Caleb', 'Diego', 'Ethan', 'Felix', 'Gavin', 'Hugo', 'Isaac', 'Jonah',
  'Kai', 'Leo', 'Marco', 'Nate', 'Owen', 'Pablo', 'Reid', 'Sam', 'Theo', 'Victor',
];

export const LAST_NAMES = [
  'Testerson', 'Sampleton', 'Mockley', 'Fakeworth', 'Dummond', 'Placeholt', 'Exampleby',
  'Simwell', 'Qualls', 'Fixturez', 'Stubbins', 'Seedwood', 'Harnessly', 'Probert',
  'Checkett', 'Verity', 'Assertson', 'Specter', 'Runyon', 'Lintner',
];

export const STREET_NAMES = [
  'Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Elm St', 'Pine Rd', 'Lakeview Dr',
  'Sunset Blvd', 'Park Ave', 'Hillcrest Rd', 'River Rd', 'Willow Way',
];

/** One real city/ZIP pair per state (each state's capital), so state/ZIP checks pass. */
export const STATE_ADDRESSES: Record<string, { city: string; zip: string; areaCode: string }> = {
  AL: { city: 'Montgomery', zip: '36104', areaCode: '334' },
  AK: { city: 'Juneau', zip: '99801', areaCode: '907' },
  AZ: { city: 'Phoenix', zip: '85004', areaCode: '602' },
  AR: { city: 'Little Rock', zip: '72201', areaCode: '501' },
  CA: { city: 'Sacramento', zip: '95814', areaCode: '916' },
  CO: { city: 'Denver', zip: '80202', areaCode: '303' },
  CT: { city: 'Hartford', zip: '06103', areaCode: '860' },
  DE: { city: 'Dover', zip: '19901', areaCode: '302' },
  DC: { city: 'Washington', zip: '20001', areaCode: '202' },
  FL: { city: 'Tallahassee', zip: '32301', areaCode: '850' },
  GA: { city: 'Atlanta', zip: '30303', areaCode: '404' },
  HI: { city: 'Honolulu', zip: '96813', areaCode: '808' },
  ID: { city: 'Boise', zip: '83702', areaCode: '208' },
  IL: { city: 'Springfield', zip: '62701', areaCode: '217' },
  IN: { city: 'Indianapolis', zip: '46204', areaCode: '317' },
  IA: { city: 'Des Moines', zip: '50309', areaCode: '515' },
  KS: { city: 'Topeka', zip: '66603', areaCode: '785' },
  KY: { city: 'Frankfort', zip: '40601', areaCode: '502' },
  LA: { city: 'Baton Rouge', zip: '70802', areaCode: '225' },
  ME: { city: 'Augusta', zip: '04330', areaCode: '207' },
  MD: { city: 'Annapolis', zip: '21401', areaCode: '410' },
  MA: { city: 'Boston', zip: '02108', areaCode: '617' },
  MI: { city: 'Lansing', zip: '48933', areaCode: '517' },
  MN: { city: 'Saint Paul', zip: '55102', areaCode: '651' },
  MS: { city: 'Jackson', zip: '39201', areaCode: '601' },
  MO: { city: 'Jefferson City', zip: '65101', areaCode: '573' },
  MT: { city: 'Helena', zip: '59601', areaCode: '406' },
  NE: { city: 'Lincoln', zip: '68508', areaCode: '402' },
  NV: { city: 'Carson City', zip: '89701', areaCode: '775' },
  NH: { city: 'Concord', zip: '03301', areaCode: '603' },
  NJ: { city: 'Trenton', zip: '08608', areaCode: '609' },
  NM: { city: 'Santa Fe', zip: '87501', areaCode: '505' },
  NY: { city: 'Albany', zip: '12207', areaCode: '518' },
  NC: { city: 'Raleigh', zip: '27601', areaCode: '919' },
  ND: { city: 'Bismarck', zip: '58501', areaCode: '701' },
  OH: { city: 'Columbus', zip: '43215', areaCode: '614' },
  OK: { city: 'Oklahoma City', zip: '73102', areaCode: '405' },
  OR: { city: 'Salem', zip: '97301', areaCode: '503' },
  PA: { city: 'Harrisburg', zip: '17101', areaCode: '717' },
  RI: { city: 'Providence', zip: '02903', areaCode: '401' },
  SC: { city: 'Columbia', zip: '29201', areaCode: '803' },
  SD: { city: 'Pierre', zip: '57501', areaCode: '605' },
  TN: { city: 'Nashville', zip: '37219', areaCode: '615' },
  TX: { city: 'Austin', zip: '78701', areaCode: '512' },
  UT: { city: 'Salt Lake City', zip: '84101', areaCode: '801' },
  VT: { city: 'Montpelier', zip: '05602', areaCode: '802' },
  VA: { city: 'Richmond', zip: '23219', areaCode: '804' },
  WA: { city: 'Olympia', zip: '98501', areaCode: '360' },
  WV: { city: 'Charleston', zip: '25301', areaCode: '304' },
  WI: { city: 'Madison', zip: '53703', areaCode: '608' },
  WY: { city: 'Cheyenne', zip: '82001', areaCode: '307' },
};

export const ALL_STATES = Object.keys(STATE_ADDRESSES);

export const SIGS = [
  'Take 1 capsule by mouth once daily',
  'Take 1 capsule by mouth at bedtime',
  'Take 1 tablet by mouth twice daily with food',
  'Apply 1 click topically to inner wrist once daily',
  'Dissolve 1 troche under the tongue once daily',
  'Inject 0.25 mL subcutaneously once weekly',
];

export const RATIONALES = [
  'Patient requires a dye-free formulation not commercially available.',
  'Commercial strength is unavailable; patient needs a compounded dose.',
  'Patient has a documented allergy to an excipient in the commercial product.',
];

/**
 * FullStackRx records ["NKDA"] (or an empty list) as "None known", so most sets name real
 * allergies; otherwise the order and script PDF only ever show "None known".
 */
export const ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Codeine', 'Latex', 'Shellfish', 'Amoxicillin', 'Aspirin'];

/** Free-text medical conditions (FullStackRx's "medical history"). No commas: the form splits on them. */
export const CONDITIONS = [
  'Hypothyroidism',
  'Hypertension',
  'Type 2 diabetes',
  'Hyperlipidemia',
  'Asthma',
  'GERD',
  'Migraine',
  'Menopause symptoms',
  'Low testosterone',
  'Anxiety',
];

/** Current medications with strength and directions. No commas: the form splits on them. */
export const MEDICATIONS = [
  'Levothyroxine 50 mcg once daily',
  'Lisinopril 10 mg once daily',
  'Metformin 500 mg twice daily',
  'Atorvastatin 20 mg at bedtime',
  'Albuterol inhaler as needed',
  'Omeprazole 20 mg once daily',
  'Sertraline 50 mg once daily',
  'Vitamin D3 2000 IU once daily',
  'Sumatriptan 50 mg as needed',
];
