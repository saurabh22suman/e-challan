import type { ChallanStatus, Severity } from '@echallan/contracts';

export type DriverLanguage = 'en' | 'hi' | 'gu';

export const DRIVER_LANGUAGES: ReadonlyArray<{ value: DriverLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'gu', label: 'ગુજરાતી' },
];

type Copy = {
  languageLabel: string;
  summaryTitle: string;
  summaryIntro: string;
  checkTitle: string;
  checkBody: string;
  issuedTitle: string;
  issuedText: string;
  replayedText: string;
  number: string;
  status: string;
  driver: string;
  vehicle: string;
  gatePass: string;
  severity: string;
  occurrence: string;
  issued: string;
  department: string;
  contractor: string;
  vehicleType: string;
  violations: string;
  remarks: string;
  locationShift: string;
  manualEntry: string;
  createAnother: string;
  statusValues: Record<ChallanStatus, string>;
  severityValues: Record<Severity, string>;
};

export const DRIVER_COPY: Record<DriverLanguage, Copy> = {
  en: {
    languageLabel: 'Driver copy language',
    summaryTitle: 'Driver summary',
    summaryIntro:
      'The driver will receive a safety-violation challan for the vehicle and violation shown below. Review it with the driver before signature.',
    checkTitle: 'Check these details with the driver',
    checkBody:
      'Read the driver name, vehicle and violations aloud. If anything is wrong, choose Change details before the driver signs.',
    issuedTitle: 'Challan issued',
    issuedText:
      'The challan is recorded. Show or read the number below to the driver before they leave the gate.',
    replayedText:
      'This challan was already issued. The saved record is shown below; no second challan was created.',
    number: 'Challan number',
    status: 'Status',
    driver: 'Driver name',
    vehicle: 'Vehicle registration',
    gatePass: 'Gate pass number',
    severity: 'Severity',
    occurrence: 'Occurrence',
    issued: 'Issued',
    department: 'Department',
    contractor: 'Contractor',
    vehicleType: 'Vehicle type',
    violations: 'Violations',
    remarks: 'Remarks',
    locationShift: 'Location / shift',
    manualEntry: 'Manual entry',
    createAnother: 'Create another challan',
    statusValues: {
      Issued: 'Issued',
      'Under Review': 'Under Review',
      Resolved: 'Resolved',
      Cancelled: 'Cancelled',
    },
    severityValues: { Minor: 'Minor', Major: 'Major', Critical: 'Critical' },
  },
  hi: {
    languageLabel: 'चालक प्रति की भाषा',
    summaryTitle: 'चालक सारांश',
    summaryIntro:
      'नीचे दिखाए गए वाहन और उल्लंघन के लिए चालक को सुरक्षा-उल्लंघन चालान जारी किया जाएगा। हस्ताक्षर से पहले चालक के साथ इसे जाँचें।',
    checkTitle: 'इन विवरणों को चालक के साथ जाँचें',
    checkBody:
      'चालक का नाम, वाहन और उल्लंघन ज़ोर से पढ़ें। कुछ गलत हो तो हस्ताक्षर से पहले “विवरण बदलें” चुनें।',
    issuedTitle: 'चालान जारी हुआ',
    issuedText:
      'चालान दर्ज कर लिया गया है। गेट छोड़ने से पहले नीचे दिया गया नंबर चालक को दिखाएँ या पढ़कर सुनाएँ।',
    replayedText:
      'यह चालान पहले ही जारी हो चुका है। नीचे सहेजा गया रिकॉर्ड दिखाया गया है; दूसरा चालान नहीं बनाया गया।',
    number: 'चालान नंबर',
    status: 'स्थिति',
    driver: 'चालक का नाम',
    vehicle: 'वाहन पंजीकरण',
    gatePass: 'गेट पास नंबर',
    severity: 'गंभीरता',
    occurrence: 'घटना',
    issued: 'जारी किया गया',
    department: 'विभाग',
    contractor: 'ठेकेदार',
    vehicleType: 'वाहन प्रकार',
    violations: 'उल्लंघन',
    remarks: 'टिप्पणियाँ',
    locationShift: 'स्थान / शिफ्ट',
    manualEntry: 'मैन्युअल प्रविष्टि',
    createAnother: 'दूसरा चालान बनाएँ',
    statusValues: {
      Issued: 'जारी',
      'Under Review': 'समीक्षाधीन',
      Resolved: 'समाधान हो गया',
      Cancelled: 'रद्द',
    },
    severityValues: { Minor: 'मामूली', Major: 'गंभीर', Critical: 'अति गंभीर' },
  },
  gu: {
    languageLabel: 'ડ્રાઇવર નકલની ભાષા',
    summaryTitle: 'ડ્રાઇવર સારાંશ',
    summaryIntro:
      'નીચે દર્શાવેલ વાહન અને ઉલ્લંઘન માટે ડ્રાઇવરને સલામતી-ઉલ્લંઘન ચલાણ જારી કરવામાં આવશે. સહી પહેલાં ડ્રાઇવર સાથે તેની સમીક્ષા કરો.',
    checkTitle: 'આ વિગતો ડ્રાઇવર સાથે તપાસો',
    checkBody:
      'ડ્રાઇવરનું નામ, વાહન અને ઉલ્લંઘન મોટેથી વાંચો. કંઈ ખોટું હોય તો સહી પહેલાં “વિગતો બદલો” પસંદ કરો.',
    issuedTitle: 'ચલાણ જારી થયું',
    issuedText:
      'ચલાણ નોંધાઈ ગયું છે. ગેટ છોડતાં પહેલાં નીચેનો નંબર ડ્રાઇવરને બતાવો અથવા મોટેથી વાંચો.',
    replayedText:
      'આ ચલાણ પહેલેથી જારી થઈ ગયું છે. નીચે સાચવેલો રેકોર્ડ દર્શાવ્યો છે; બીજું ચલાણ બનાવ્યું નથી.',
    number: 'ચલાણ નંબર',
    status: 'સ્થિતિ',
    driver: 'ડ્રાઇવરનું નામ',
    vehicle: 'વાહન નોંધણી',
    gatePass: 'ગેટ પાસ નંબર',
    severity: 'ગંભીરતા',
    occurrence: 'ઘટના',
    issued: 'જારી કરેલ',
    department: 'વિભાગ',
    contractor: 'કોન્ટ્રાક્ટર',
    vehicleType: 'વાહન પ્રકાર',
    violations: 'ઉલ્લંઘન',
    remarks: 'ટિપ્પણીઓ',
    locationShift: 'સ્થળ / શિફ્ટ',
    manualEntry: 'મેન્યુઅલ એન્ટ્રી',
    createAnother: 'બીજું ચલાણ બનાવો',
    statusValues: {
      Issued: 'જારી',
      'Under Review': 'સમીક્ષા હેઠળ',
      Resolved: 'ઉકેલાયું',
      Cancelled: 'રદ',
    },
    severityValues: { Minor: 'સામાન્ય', Major: 'ગંભીર', Critical: 'અતિ ગંભીર' },
  },
};
