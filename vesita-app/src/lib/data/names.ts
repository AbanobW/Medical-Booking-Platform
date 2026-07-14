/**
 * Egyptian name pools used to synthesize realistic providers and patients.
 *
 * Each entry is `[latin, arabic]` — the same person, written in both scripts.
 * A doctor's name is *content*, not chrome: "د. Nader Kamal" in an Arabic
 * listing reads like a data-entry error, and `Provider.nameAr` exists precisely
 * so it doesn't have to. The pair is picked in one draw, so the Arabic form
 * always matches the Latin one rather than being an independent lottery.
 */
type NamePair = readonly [string, string];

export const MALE_FIRST: NamePair[] = [
  ["Ahmed", "أحمد"], ["Mohamed", "محمد"], ["Mahmoud", "محمود"], ["Mostafa", "مصطفى"],
  ["Khaled", "خالد"], ["Tarek", "طارق"], ["Hossam", "حسام"], ["Amr", "عمرو"],
  ["Karim", "كريم"], ["Sherif", "شريف"], ["Yasser", "ياسر"], ["Ayman", "أيمن"],
  ["Hesham", "هشام"], ["Wael", "وائل"], ["Sameh", "سامح"], ["Ashraf", "أشرف"],
  ["Ibrahim", "إبراهيم"], ["Omar", "عمر"], ["Youssef", "يوسف"], ["Adel", "عادل"],
  ["Magdy", "مجدي"], ["Nader", "نادر"], ["Ramy", "رامي"], ["Waleed", "وليد"],
  ["Emad", "عماد"], ["Islam", "إسلام"], ["Alaa", "علاء"], ["Bassem", "باسم"],
  ["Gamal", "جمال"], ["Hany", "هاني"], ["Sherbiny", "شربيني"], ["Mazen", "مازن"],
];

export const FEMALE_FIRST: NamePair[] = [
  ["Mona", "منى"], ["Nadia", "نادية"], ["Heba", "هبة"], ["Rania", "رانيا"],
  ["Yasmin", "ياسمين"], ["Dina", "دينا"], ["Sara", "سارة"], ["Noha", "نهى"],
  ["Amira", "أميرة"], ["Ghada", "غادة"], ["Salma", "سلمى"], ["Marwa", "مروة"],
  ["Doaa", "دعاء"], ["Reem", "ريم"], ["Nourhan", "نورهان"], ["Hala", "هالة"],
  ["Shaimaa", "شيماء"], ["Eman", "إيمان"], ["Nesma", "نسمة"], ["Aya", "آية"],
  ["Maha", "مها"], ["Sherine", "شيرين"], ["Injy", "إنجي"], ["Passant", "بسنت"],
  ["Fatma", "فاطمة"], ["Asmaa", "أسماء"], ["Radwa", "رضوى"], ["Menna", "منة"],
  ["Nada", "ندى"], ["Basma", "بسمة"],
];

export const LAST_NAMES: NamePair[] = [
  ["Hassan", "حسن"], ["Ibrahim", "إبراهيم"], ["El Sayed", "السيد"],
  ["Abdel Rahman", "عبد الرحمن"], ["Fouad", "فؤاد"], ["Nabil", "نبيل"],
  ["Zaki", "زكي"], ["Kamal", "كمال"], ["Shawky", "شوقي"], ["El Masry", "المصري"],
  ["Abdel Aziz", "عبد العزيز"], ["Mansour", "منصور"], ["Soliman", "سليمان"],
  ["Fahmy", "فهمي"], ["El Gohary", "الجوهري"], ["Anwar", "أنور"],
  ["Rashad", "رشاد"], ["Sabry", "صبري"], ["Helmy", "حلمي"], ["Lotfy", "لطفي"],
  ["El Shazly", "الشاذلي"], ["Badawy", "بدوي"], ["Hegazy", "حجازي"],
  ["Selim", "سليم"], ["Nassar", "نصار"], ["Ramadan", "رمضان"],
  ["El Kholy", "الخولي"], ["Sultan", "سلطان"], ["Darwish", "درويش"],
  ["Awad", "عوض"], ["El Bahnasawy", "البهنساوي"], ["Farag", "فرج"],
  ["Ghanem", "غانم"], ["Hamdy", "حمدي"], ["Kassem", "قاسم"],
];

export const DOCTOR_TITLES = [
  "Professor Doctor",
  "Consultant",
  "Specialist",
  "Lecturer Doctor",
] as const;

export const DEGREES = [
  "MBBCh, Cairo University",
  "MSc, Ain Shams University",
  "MD (Doctorate), Cairo University",
  "MRCP (UK)",
  "Fellowship, Royal College of Surgeons",
  "MSc, Alexandria University",
  "MD, Mansoura University",
  "Board Certified, Egyptian Fellowship",
  "Diploma, Kasr Al Ainy",
  "PhD, Ain Shams University",
];

export const LANGUAGES = ["Arabic", "English", "French", "German"];

export const LAB_BRANDS = [
  "Al Borg", "Alfa", "Mokhtabar", "Cairo Lab", "El Ezaby Labs", "Royal Lab",
  "Delta Diagnostics", "Nile Medical Lab", "Prime Lab", "Vital Diagnostics",
  "MedLab Egypt", "Horus Laboratories", "Sphinx Diagnostics", "Elite Lab",
  "Care Diagnostics", "Nour Lab", "Salam Laboratories", "Precision Labs",
  "Genesis Lab", "Pharos Diagnostics", "Andalusia Labs", "Wellness Lab",
];

export const RADIOLOGY_BRANDS = [
  "Alfa Scan", "Misr Radiology Center", "Scan Plus", "Nile Scan & Labs",
  "Radiology One", "El Nada Scan", "Cairo Scan", "Delta Imaging Center",
  "Horus Radiology", "Vision Imaging", "Pyramids Scan", "Advanced Imaging",
  "MedScan Egypt", "Royal Imaging Center", "Precision Radiology", "Sphinx Scan",
  "Elite Imaging", "Nour Radiology", "Pharos Imaging", "Andalusia Scan",
  "Genesis Imaging", "Life Scan Center",
];

export const LAB_ACCREDITATIONS = [
  "ISO 15189",
  "CAP Accredited",
  "Egyptian MOH Licensed",
  "ISO 9001:2015",
  "JCI Standards",
];

export const CLINIC_SUFFIXES = [
  "Medical Center", "Clinic", "Polyclinic", "Specialized Center",
  "Medical Complex", "Health Center",
];

export const REVIEW_COMMENTS_POSITIVE = [
  "Excellent doctor, very patient and explained everything in detail. Highly recommended.",
  "The clinic was clean and the staff were welcoming. Waiting time was short.",
  "Very professional and knowledgeable. I felt comfortable throughout the visit.",
  "Booking through the app was easy and the appointment started on time.",
  "One of the best doctors I have visited. Took the time to answer all my questions.",
  "Great experience overall. Reasonable price and accurate diagnosis.",
  "The treatment plan worked perfectly. I am feeling much better now.",
  "Results came back faster than promised and the staff explained them clearly.",
  "Modern equipment and a very organized reception team.",
  "Truly caring and attentive. Will definitely book again.",
];

export const REVIEW_COMMENTS_MIXED = [
  "The doctor was good but I waited almost an hour past my appointment time.",
  "Decent experience, though the clinic was a bit crowded.",
  "Professional service, but parking around the clinic is difficult.",
  "Good consultation overall. Prices are slightly on the higher side.",
  "The examination was thorough but the reception staff could be friendlier.",
];

export const REVIEW_COMMENTS_NEGATIVE = [
  "Waited over 90 minutes and the consultation felt rushed.",
  "The appointment was rescheduled twice without proper notice.",
  "Not what I expected for the price. I would not book again.",
];

export const CANCELLATION_REASONS = [
  "Schedule conflict",
  "Found an earlier appointment",
  "Feeling better, no longer needed",
  "Provider rescheduled",
  "Travel plans changed",
  "Financial reasons",
];

export const STREETS = [
  "El Batal Ahmed Abdel Aziz St.",
  "Gameat El Dowal El Arabeya St.",
  "El Thawra St.",
  "Abbas El Akkad St.",
  "Makram Ebeid St.",
  "El Nasr Road",
  "Road 9",
  "El Merghany St.",
  "Syria St.",
  "El Higaz St.",
  "Mostafa El Nahas St.",
  "El Tahrir St.",
  "El Gomhoreya St.",
  "Salah Salem Road",
  "Ahmed Orabi St.",
  "El Horreya Road",
];
