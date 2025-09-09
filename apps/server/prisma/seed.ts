import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar laboratórios
  const labs = await Promise.all([
    prisma.lab.upsert({
      where: { name: 'EMS' },
      update: {},
      create: {
        name: 'EMS',
        cnpj: '57.507.378/0001-01',
      },
    }),
    prisma.lab.upsert({
      where: { name: 'Eurofarma' },
      update: {},
      create: {
        name: 'Eurofarma',
        cnpj: '61.190.096/0001-92',
      },
    }),
    prisma.lab.upsert({
      where: { name: 'Medley' },
      update: {},
      create: {
        name: 'Medley',
        cnpj: '10.588.595/0001-10',
      },
    }),
    prisma.lab.upsert({
      where: { name: 'Sanofi' },
      update: {},
      create: {
        name: 'Sanofi',
        cnpj: '02.685.377/0001-57',
      },
    }),
    prisma.lab.upsert({
      where: { name: 'Pfizer' },
      update: {},
      create: {
        name: 'Pfizer',
        cnpj: '46.070.868/0001-69',
      },
    }),
  ]);

  console.log(`✅ Criados ${labs.length} laboratórios`);

  // Criar medicamentos
  const medications = await Promise.all([
    prisma.medication.upsert({
      where: { code: 'PARACETAMOL-500MG' },
      update: {},
      create: {
        code: 'PARACETAMOL-500MG',
        name: 'Paracetamol 500mg',
        activeIngredient: 'Paracetamol',
        category: 'Analgésico',
      },
    }),
    prisma.medication.upsert({
      where: { code: 'DIPIRONA-500MG' },
      update: {},
      create: {
        code: 'DIPIRONA-500MG',
        name: 'Dipirona Sódica 500mg',
        activeIngredient: 'Dipirona Sódica',
        category: 'Analgésico',
      },
    }),
    prisma.medication.upsert({
      where: { code: 'IBUPROFENO-400MG' },
      update: {},
      create: {
        code: 'IBUPROFENO-400MG',
        name: 'Ibuprofeno 400mg',
        activeIngredient: 'Ibuprofeno',
        category: 'Anti-inflamatório',
      },
    }),
    prisma.medication.upsert({
      where: { code: 'AMOXICILINA-500MG' },
      update: {},
      create: {
        code: 'AMOXICILINA-500MG',
        name: 'Amoxicilina 500mg',
        activeIngredient: 'Amoxicilina',
        category: 'Antibiótico',
      },
    }),
    prisma.medication.upsert({
      where: { code: 'LOSARTANA-50MG' },
      update: {},
      create: {
        code: 'LOSARTANA-50MG',
        name: 'Losartana Potássica 50mg',
        activeIngredient: 'Losartana Potássica',
        category: 'Anti-hipertensivo',
      },
    }),
    prisma.medication.upsert({
      where: { code: 'METFORMINA-850MG' },
      update: {},
      create: {
        code: 'METFORMINA-850MG',
        name: 'Metformina 850mg',
        activeIngredient: 'Cloridrato de Metformina',
        category: 'Antidiabético',
      },
    }),
    prisma.medication.upsert({
      where: { code: 'OMEPRAZOL-20MG' },
      update: {},
      create: {
        code: 'OMEPRAZOL-20MG',
        name: 'Omeprazol 20mg',
        activeIngredient: 'Omeprazol',
        category: 'Protetor Gástrico',
      },
    }),
    prisma.medication.upsert({
      where: { code: 'SINVASTATINA-20MG' },
      update: {},
      create: {
        code: 'SINVASTATINA-20MG',
        name: 'Sinvastatina 20mg',
        activeIngredient: 'Sinvastatina',
        category: 'Hipolipemiante',
      },
    }),
  ]);

  console.log(`✅ Criados ${medications.length} medicamentos`);

  // Criar usuário admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@raymed.com' },
    update: {},
    create: {
      email: 'admin@raymed.com',
      name: 'Administrador',
      role: 'admin',
    },
  });

  // Criar usuário teste
  const testUser = await prisma.user.upsert({
    where: { email: 'teste@raymed.com' },
    update: {},
    create: {
      email: 'teste@raymed.com',
      name: 'Usuário Teste',
      role: 'user',
    },
  });

  console.log(`✅ Criados usuários: ${adminUser.name}, ${testUser.name}`);

  // Criar preços históricos (últimos 90 dias)
  const now = new Date();
  const pricesData = [];

  for (const medication of medications) {
    for (const lab of labs.slice(0, 3)) { // Apenas 3 labs por medicamento
      for (let i = 90; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Preço base com variação aleatória
        const basePrice = Math.random() * 20 + 5; // Entre R$ 5 e R$ 25
        const variation = (Math.random() - 0.5) * 0.2; // ±10%
        const price = basePrice * (1 + variation);
        
        pricesData.push({
          medicationId: medication.id,
          labId: lab.id,
          value: Math.round(price * 100) / 100, // 2 casas decimais
          capturedAt: date,
          source: 'SEED',
          meta: JSON.stringify({
            seeded: true,
            basePrice,
            variation,
          }),
        });
      }
    }
  }

  // Inserir preços em lotes
  const batchSize = 100;
  let createdPrices = 0;

  for (let i = 0; i < pricesData.length; i += batchSize) {
    const batch = pricesData.slice(i, i + batchSize);
    await prisma.price.createMany({
      data: batch,
    });
    createdPrices += batch.length;
  }

  console.log(`✅ Criados ${createdPrices} registros de preços`);

  // Criar algumas inscrições de teste
  const subscriptions = await Promise.all([
    prisma.subscription.create({
      data: {
        userId: testUser.id,
        medicationId: medications[0].id, // Paracetamol
        minDropPct: 0.05, // 5%
        targetPrice: 8.50,
        isActive: true,
      },
    }),
    prisma.subscription.create({
      data: {
        userId: testUser.id,
        medicationId: medications[1].id, // Dipirona
        labId: labs[0].id, // EMS
        minDropPct: 0.10, // 10%
        isActive: true,
      },
    }),
    prisma.subscription.create({
      data: {
        userId: adminUser.id,
        medicationId: medications[2].id, // Ibuprofeno
        targetPrice: 12.00,
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Criadas ${subscriptions.length} inscrições de teste`);

  // Criar algumas métricas iniciais
  const metrics = await Promise.all([
    prisma.systemMetric.create({
      data: {
        name: 'total_medications',
        value: medications.length,
        tags: JSON.stringify({ category: 'count' }),
      },
    }),
    prisma.systemMetric.create({
      data: {
        name: 'total_labs',
        value: labs.length,
        tags: JSON.stringify({ category: 'count' }),
      },
    }),
    prisma.systemMetric.create({
      data: {
        name: 'total_users',
        value: 2,
        tags: JSON.stringify({ category: 'count' }),
      },
    }),
    prisma.systemMetric.create({
      data: {
        name: 'avg_price',
        value: pricesData.reduce((sum, p) => sum + p.value, 0) / pricesData.length,
        tags: JSON.stringify({ category: 'price', period: 'all_time' }),
      },
    }),
  ]);

  console.log(`✅ Criadas ${metrics.length} métricas iniciais`);

  console.log('🎉 Seed concluído com sucesso!');
  console.log('\nDados criados:');
  console.log(`- ${labs.length} laboratórios`);
  console.log(`- ${medications.length} medicamentos`);
  console.log(`- 2 usuários (admin@raymed.com, teste@raymed.com)`);
  console.log(`- ${createdPrices} registros de preços`);
  console.log(`- ${subscriptions.length} inscrições`);
  console.log(`- ${metrics.length} métricas`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro no seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
