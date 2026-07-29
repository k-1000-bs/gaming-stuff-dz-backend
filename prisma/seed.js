const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // --- Compte administrateur ---
  const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@gamingstuffdz.com' },
    update: {},
    create: {
      fullName: 'Admin Gaming Stuff DZ',
      email: 'admin@gamingstuffdz.com',
      password: adminPassword,
      role: 'ADMIN',
      isEmailVerified: true,
      cart: { create: {} },
    },
  });

  // --- Catégories ---
  const categorie = await prisma.category.upsert({
    where: { slug: 'accessoires-gaming' },
    update: {},
    create: { name: 'Accessoires Gaming', slug: 'accessoires-gaming' },
  });

  // --- Produits réels du site ---
  const products = [
    {
      name: 'Casque Gaming L80 Pro',
      slug: 'casque-gaming-l80-pro',
      brand: 'Attack Shark',
      sku: 'AS-L80PRO',
      price: 9900,
      description:
        "Casque gaming sans fil tri-mode (2.4GHz, Bluetooth 5.3, jack 3.5mm) avec double microphone détachable anti-bruit. Compatible PC, PS4/PS5, Xbox, Switch et Mac.",
      shortDescription: 'Casque gaming tri-mode avec micro détachable anti-bruit.',
      specs: [
        { label: 'Connectivité', value: '2.4GHz / Bluetooth 5.3 / Jack 3.5mm' },
        { label: 'Latence', value: '20 ms (mode 2.4GHz)' },
        { label: 'Haut-parleurs', value: 'Driver 40 mm' },
        { label: 'Autonomie', value: 'Environ 25h' },
      ],
      variants: [
        { color: 'Noir', sku: 'AS-L80PRO-NOIR', stock: 25 },
        { color: 'Blanc', sku: 'AS-L80PRO-BLANC', stock: 20 },
      ],
    },
    {
      name: 'Clavier X68 HE (mode Light)',
      slug: 'clavier-x68-he',
      brand: 'Attack Shark',
      sku: 'AS-X68HE',
      price: 14000,
      description:
        "Clavier mécanique 60% à switches magnétiques Hall Effect avec Rapid Trigger, polling rate 8000Hz et rétroéclairage RGB personnalisable.",
      shortDescription: 'Clavier 60% Hall Effect avec Rapid Trigger.',
      specs: [
        { label: 'Format', value: '60% TKL' },
        { label: 'Switches', value: 'Magnétiques Hall Effect, Rapid Trigger' },
        { label: 'Polling rate', value: '8000 Hz' },
        { label: 'Connexion', value: 'Filaire USB-C' },
      ],
      variants: [
        { color: 'Noir', sku: 'AS-X68HE-NOIR', stock: 15 },
        { color: 'Blanc', sku: 'AS-X68HE-BLANC', stock: 12 },
        { color: 'Gris', sku: 'AS-X68HE-GRIS', stock: 8 },
      ],
    },
    {
      name: 'Souris Gaming X11',
      slug: 'souris-gaming-x11',
      brand: 'Attack Shark',
      sku: 'AS-X11',
      price: 6900,
      description:
        "Souris gaming légère tri-mode (2.4GHz, Bluetooth, USB-C) équipée du capteur PAW3311, 5 boutons programmables, station de charge RGB incluse.",
      shortDescription: 'Souris tri-mode légère, capteur PAW3311.',
      specs: [
        { label: 'Capteur', value: 'PixArt PAW3311' },
        { label: 'DPI', value: "Jusqu'à 22 000" },
        { label: 'Polling rate', value: '1000 Hz' },
        { label: 'Poids', value: '≈ 62 g' },
      ],
      variants: [
        { color: 'Noir', sku: 'AS-X11-NOIR', stock: 30 },
        { color: 'Blanc', sku: 'AS-X11-BLANC', stock: 18 },
      ],
    },
  ];

  for (const p of products) {
    const { specs, variants, ...data } = p;
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        ...data,
        categoryId: categorie.id,
        specs: { create: specs },
        variants: { create: variants },
      },
    });
  }

  console.log('Seed terminé : admin + catégorie + 3 produits créés.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
