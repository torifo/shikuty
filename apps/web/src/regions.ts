export interface Region {
  name: string;
  prefCodes: string[];
}

export const REGIONS: Region[] = [
  { name: "北海道", prefCodes: ["01"] },
  { name: "東北", prefCodes: ["02", "03", "04", "05", "06", "07"] },
  { name: "関東", prefCodes: ["08", "09", "10", "11", "12", "13", "14"] },
  { name: "中部", prefCodes: ["15", "16", "17", "18", "19", "20", "21", "22", "23"] },
  { name: "近畿", prefCodes: ["24", "25", "26", "27", "28", "29", "30"] },
  { name: "中国", prefCodes: ["31", "32", "33", "34", "35"] },
  { name: "四国", prefCodes: ["36", "37", "38", "39"] },
  { name: "九州・沖縄", prefCodes: ["40", "41", "42", "43", "44", "45", "46", "47"] },
];
