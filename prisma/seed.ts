import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create super admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@esvitaclinic.com' },
    update: {},
    create: {
      email: 'admin@esvitaclinic.com',
      name: 'System Administrator',
      role: 'super_admin',
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create sample audiences
  const audiences = [
    { name: 'Dr. Sarah Johnson', email: 'sarah.johnson@esvitaclinic.com', preferredLanguage: 'EN' },
    { name: 'Dr. Marc Dubois', email: 'marc.dubois@esvitaclinic.com', preferredLanguage: 'FRA' },
    { name: 'Dr. Ivan Petrov', email: 'ivan.petrov@esvitaclinic.com', preferredLanguage: 'RU' },
    { name: 'Dr. Ayşe Kaya', email: 'ayse.kaya@esvitaclinic.com', preferredLanguage: 'TR' },
    { name: 'Dr. Giulia Romano', email: 'giulia.romano@esvitaclinic.com', preferredLanguage: 'ITA' },
  ];

  for (const a of audiences) {
    await prisma.audience.upsert({
      where: { email: a.email },
      update: {},
      create: a,
    });
  }

  console.log('✅ Sample audiences created');

  // Create a sample exam
  const exam = await prisma.exam.upsert({
    where: { id: 'sample-exam-001' },
    update: {},
    create: {
      id: 'sample-exam-001',
      titleEn: 'Medical Knowledge Assessment Q1 2024',
      titleTr: 'Tıbbi Bilgi Değerlendirmesi Q1 2024',
      titleFra: 'Évaluation des Connaissances Médicales Q1 2024',
      descriptionEn: 'Quarterly medical advisor competency assessment covering product knowledge and clinical guidelines.',
      descriptionTr: 'Ürün bilgisi ve klinik kılavuzları kapsayan üç aylık tıbbi danışman yetkinlik değerlendirmesi.',
      timePerQuestion: 60,
      isActive: true,
      createdBy: admin.id,
    },
  });

  // Create sample questions
  const questions = [
    {
      orderIndex: 0,
      questionEn: 'What is the primary mechanism of action of ACE inhibitors?',
      questionTr: 'ACE inhibitörlerinin birincil etki mekanizması nedir?',
      optionsEn: JSON.stringify([
        { key: 'A', value: 'Block calcium channels in vascular smooth muscle' },
        { key: 'B', value: 'Inhibit angiotensin-converting enzyme, reducing angiotensin II production' },
        { key: 'C', value: 'Block beta-adrenergic receptors in the heart' },
        { key: 'D', value: 'Stimulate aldosterone release from adrenal cortex' },
      ]),
      optionsTr: JSON.stringify([
        { key: 'A', value: 'Vasküler düz kastaki kalsiyum kanallarını bloke eder' },
        { key: 'B', value: 'Anjiyotensin dönüştürücü enzimi inhibe ederek anjiyotensin II üretimini azaltır' },
        { key: 'C', value: 'Kalpteki beta-adrenerjik reseptörleri bloke eder' },
        { key: 'D', value: 'Adrenal korteksten aldosteron salınımını uyarır' },
      ]),
      correctAnswer: 'B',
      explanationEn: 'ACE inhibitors work by blocking angiotensin-converting enzyme (ACE), which converts angiotensin I to angiotensin II. This reduces vasoconstriction and aldosterone secretion, leading to decreased blood pressure.',
      explanationTr: 'ACE inhibitörleri, anjiyotensin I\'i anjiyotensin II\'ye dönüştüren anjiyotensin dönüştürücü enzimi (ACE) bloke ederek çalışır. Bu, vazokonstriksiyon ve aldosteron sekresyonunu azaltarak kan basıncının düşmesine yol açar.',
    },
    {
      orderIndex: 1,
      questionEn: 'Which of the following is NOT a contraindication for statin therapy?',
      questionTr: 'Aşağıdakilerden hangisi statin tedavisinin kontrendikasyonu DEĞİLDİR?',
      optionsEn: JSON.stringify([
        { key: 'A', value: 'Active liver disease' },
        { key: 'B', value: 'Pregnancy' },
        { key: 'C', value: 'Mild hyperlipidemia' },
        { key: 'D', value: 'Unexplained persistent elevations in serum transaminases' },
      ]),
      optionsTr: JSON.stringify([
        { key: 'A', value: 'Aktif karaciğer hastalığı' },
        { key: 'B', value: 'Gebelik' },
        { key: 'C', value: 'Hafif hiperlipidemi' },
        { key: 'D', value: 'Serum transaminazlarında açıklanamayan kalıcı yükselmeler' },
      ]),
      correctAnswer: 'C',
      explanationEn: 'Mild hyperlipidemia is actually an indication for statin therapy, not a contraindication. Statins are used to lower elevated cholesterol levels. Contraindications include active liver disease, pregnancy, and persistent transaminase elevations.',
      explanationTr: 'Hafif hiperlipidemi aslında statin tedavisinin kontrendikasyonu değil, bir endikasyonudur. Statinler yüksek kolesterol seviyelerini düşürmek için kullanılır. Kontrendikasyonlar arasında aktif karaciğer hastalığı, gebelik ve kalıcı transaminaz yükselmeleri yer alır.',
    },
    {
      orderIndex: 2,
      questionEn: 'What is the first-line treatment for Type 2 Diabetes Mellitus in a patient without contraindications?',
      questionTr: 'Kontrendikasyonu olmayan bir hastada Tip 2 Diabetes Mellitus için birinci basamak tedavi nedir?',
      optionsEn: JSON.stringify([
        { key: 'A', value: 'Insulin therapy' },
        { key: 'B', value: 'Metformin' },
        { key: 'C', value: 'Sulfonylureas' },
        { key: 'D', value: 'GLP-1 receptor agonists' },
      ]),
      optionsTr: JSON.stringify([
        { key: 'A', value: 'İnsülin tedavisi' },
        { key: 'B', value: 'Metformin' },
        { key: 'C', value: 'Sülfonilüreler' },
        { key: 'D', value: 'GLP-1 reseptör agonistleri' },
      ]),
      correctAnswer: 'B',
      explanationEn: 'Metformin remains the preferred initial pharmacological treatment for Type 2 Diabetes due to its efficacy, safety profile, low cost, and potential cardiovascular benefits. It reduces hepatic glucose production and improves insulin sensitivity.',
      explanationTr: 'Metformin, etkinliği, güvenlik profili, düşük maliyeti ve potansiyel kardiyovasküler faydaları nedeniyle Tip 2 Diyabet için tercih edilen başlangıç farmakolojik tedavisi olmaya devam etmektedir.',
    },
  ];

  for (const q of questions) {
    await prisma.question.create({
      data: {
        examId: exam.id,
        ...q,
      },
    });
  }

  console.log('✅ Sample exam and questions created');
  console.log('\n🎉 Database seeded successfully!');
  console.log('\nAdmin login: admin@esvitaclinic.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
