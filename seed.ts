import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Helper functions
const getRandomItem = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];
const getRandomItems = <T>(array: T[], count: number): T[] => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Constants for realistic data
const CLOTHING_BRANDS = [
  'Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo', 'Forever 21', 'Urban Outfitters',
  'ASOS', 'Topshop', 'Mango', 'Calvin Klein', 'Tommy Hilfiger', 'Levi\'s',
  'GAP', 'Old Navy', 'American Eagle', 'Hollister', 'Victoria\'s Secret',
  'Ralph Lauren', 'Gucci', 'Prada', 'Louis Vuitton', 'Chanel', 'Versace'
];

const CLOTHING_CATEGORIES = [
  'Dresses', 'Tops & Blouses', 'Pants & Jeans', 'Skirts', 'Shorts',
  'Jackets & Coats', 'Sweaters & Cardigans', 'Activewear', 'Swimwear',
  'Underwear & Lingerie', 'Shoes', 'Bags & Accessories', 'Jewelry',
  'Watches', 'Sunglasses', 'Suits', 'Ties & Bow Ties', 'Formal Wear'
];

const CLOTHING_TAGS = [
  'casual', 'formal', 'vintage', 'modern', 'bohemian', 'minimalist',
  'streetwear', 'luxury', 'sustainable', 'handmade', 'designer',
  'trendy', 'classic', 'edgy', 'feminine', 'masculine', 'unisex'
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42', '44', '46'];
const COLORS = [
  'Black', 'White', 'Gray', 'Navy', 'Blue', 'Red', 'Pink', 'Green',
  'Yellow', 'Orange', 'Purple', 'Brown', 'Beige', 'Cream', 'Gold', 'Silver'
];

const NIGERIAN_CITIES = [
  'Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City',
  'Kaduna', 'Jos', 'Ilorin', 'Owerri', 'Enugu', 'Abeokuta', 'Warri'
];

const NIGERIAN_STATES = [
  'Lagos', 'Abuja FCT', 'Kano', 'Oyo', 'Rivers', 'Edo', 'Kaduna',
  'Plateau', 'Kwara', 'Imo', 'Enugu', 'Ogun', 'Delta'
];

// Generate Nigerian bank details
const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'GTBank', code: '058' },
  { name: 'First Bank', code: '011' },
  { name: 'UBA', code: '033' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Stanbic IBTC', code: '221' }
];

// Unsplash image collections for different product types
const UNSPLASH_FASHION_COLLECTIONS = {
  // Women's fashion
  dresses: [
    'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446',
    'https://images.unsplash.com/photo-1566479179817-73ec8bcef55e',
    'https://images.unsplash.com/photo-1539008835657-9e8e9680c956',
    'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1',
    'https://images.unsplash.com/photo-1594633313593-bab3825d0caf'
  ],
  tops: [
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
    'https://images.unsplash.com/photo-1571513722275-4b9cdb0c6482',
    'https://images.unsplash.com/photo-1583743814966-8936f37f4678',
    'https://images.unsplash.com/photo-1564584217132-2271feaeb3c5',
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96'
  ],
  pants: [
    'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1',
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246',
    'https://images.unsplash.com/photo-1582418702059-97ebafb35d09',
    'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91',
    'https://images.unsplash.com/photo-1624378515195-6bbdb73dff1a'
  ],
  shoes: [
    'https://images.unsplash.com/photo-1549298916-b41d501d3772',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2',
    'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    'https://images.unsplash.com/photo-1608667508764-33cf0726b13a'
  ],
  bags: [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
    'https://images.unsplash.com/photo-1590736969955-71cc94901144',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3',
    'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d',
    'https://images.unsplash.com/photo-1553735503-7cc5ac882d5a'
  ],
  jackets: [
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea',
    'https://images.unsplash.com/photo-1551028719-00167b16eac5',
    'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f',
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
    'https://images.unsplash.com/photo-1556905055-8f358a7a47b2'
  ],
  // Men's fashion
  menShirts: [
    'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf',
    'https://images.unsplash.com/photo-1603252109303-2751441dd157',
    'https://images.unsplash.com/photo-1598033129183-c4f50c736f10',
    'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4',
    'https://images.unsplash.com/photo-1594938298603-c8148c4dae35'
  ],
  menPants: [
    'https://images.unsplash.com/photo-1473966968600-fa801b869a1a',
    'https://images.unsplash.com/photo-1582418702059-97ebafb35d09',
    'https://images.unsplash.com/photo-1506629905607-21d5b6e7f50b',
    'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1',
    'https://images.unsplash.com/photo-1555689502-c4b22d76c56f'
  ],
  menShoes: [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000',
    'https://images.unsplash.com/photo-1552346154-21d32810aba3',
    'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77',
    'https://images.unsplash.com/photo-1608667508764-33cf0726b13a',
    'https://images.unsplash.com/photo-1562183241-b937e95585b6'
  ],
  // Accessories
  watches: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
    'https://images.unsplash.com/photo-1524805444758-089113d48a6d',
    'https://images.unsplash.com/photo-1533139502658-0198f920d8e8',
    'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd',
    'https://images.unsplash.com/photo-1508057198894-247b23fe5ade'
  ],
  jewelry: [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338',
    'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0',
    'https://images.unsplash.com/photo-1596944924616-7b38e7cfac36',
    'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0',
    'https://images.unsplash.com/photo-1632353934214-d9b0b8bbbc4d'
  ],
  sunglasses: [
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f',
    'https://images.unsplash.com/photo-1511499767150-a48a237f0083',
    'https://images.unsplash.com/photo-1508296695146-257a814070b4',
    'https://images.unsplash.com/photo-1556306535-38febf6782e7',
    'https://images.unsplash.com/photo-1577803645773-f96470509666'
  ]
};

// Function to get appropriate image based on product category
const getProductImages = (categories: string[], gender: string, count: number = 3) => {
  let imagePool: string[] = [];

  // Determine image pool based on categories
  if (categories.some(cat => cat.toLowerCase().includes('dress'))) {
    imagePool = UNSPLASH_FASHION_COLLECTIONS.dresses;
  } else if (categories.some(cat => cat.toLowerCase().includes('top') || cat.toLowerCase().includes('blouse') || cat.toLowerCase().includes('shirt'))) {
    imagePool = gender === 'MEN' ? UNSPLASH_FASHION_COLLECTIONS.menShirts : UNSPLASH_FASHION_COLLECTIONS.tops;
  } else if (categories.some(cat => cat.toLowerCase().includes('pants') || cat.toLowerCase().includes('jean'))) {
    imagePool = gender === 'MEN' ? UNSPLASH_FASHION_COLLECTIONS.menPants : UNSPLASH_FASHION_COLLECTIONS.pants;
  } else if (categories.some(cat => cat.toLowerCase().includes('shoe'))) {
    imagePool = gender === 'MEN' ? UNSPLASH_FASHION_COLLECTIONS.menShoes : UNSPLASH_FASHION_COLLECTIONS.shoes;
  } else if (categories.some(cat => cat.toLowerCase().includes('bag'))) {
    imagePool = UNSPLASH_FASHION_COLLECTIONS.bags;
  } else if (categories.some(cat => cat.toLowerCase().includes('jacket') || cat.toLowerCase().includes('coat'))) {
    imagePool = UNSPLASH_FASHION_COLLECTIONS.jackets;
  } else if (categories.some(cat => cat.toLowerCase().includes('watch'))) {
    imagePool = UNSPLASH_FASHION_COLLECTIONS.watches;
  } else if (categories.some(cat => cat.toLowerCase().includes('jewelry'))) {
    imagePool = UNSPLASH_FASHION_COLLECTIONS.jewelry;
  } else if (categories.some(cat => cat.toLowerCase().includes('sunglasses'))) {
    imagePool = UNSPLASH_FASHION_COLLECTIONS.sunglasses;
  } else {
    // Default to mixed fashion images
    imagePool = [
      ...UNSPLASH_FASHION_COLLECTIONS.dresses,
      ...UNSPLASH_FASHION_COLLECTIONS.tops,
      ...UNSPLASH_FASHION_COLLECTIONS.pants
    ];
  }

  // Add size parameters for consistent sizing
  const sizedImages = imagePool.map(url => `${url}?w=640&h=640&fit=crop&crop=center`);

  // Return random selection
  return getRandomItems(sizedImages, Math.min(count, sizedImages.length));
};

async function generateUsers(count: number = 100) {
  console.log(`🔄 Generating ${count} users...`);

  const users = [];
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const bank = getRandomItem(NIGERIAN_BANKS);

    users.push({
      id: faker.string.uuid(),
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      emailVerified: faker.datatype.boolean({ probability: 0.8 }),
      password: '$2b$10$' + faker.string.alphanumeric(53), // Simulated bcrypt hash
      name: `${firstName} ${lastName}`,
      imageUrl: faker.image.avatar(),
      bio: faker.datatype.boolean({ probability: 0.6 }) ? faker.person.bio() : null,
      userName: faker.internet.username({ firstName, lastName }).toLowerCase(),
      bankCode: bank.code,
      bankName: bank.name,
      bankAccountName: `${firstName} ${lastName}`,
      bankAccountNumber: faker.string.numeric(10),
      recipientCode: faker.string.alphanumeric(10),
      isDeactivated: faker.datatype.boolean({ probability: 0.05 }),
      deactivatedAt: faker.datatype.boolean({ probability: 0.05 }) ? faker.date.recent() : null,
      googleId: faker.datatype.boolean({ probability: 0.3 }) ? faker.string.numeric(21) : null,
      appleId: faker.datatype.boolean({ probability: 0.1 }) ? faker.string.alphanumeric(20) : null,
      enableBundleBuying: faker.datatype.boolean({ probability: 0.4 }),
      userUnavailable: faker.datatype.boolean({ probability: 0.1 }),
    });
  }

  await prisma.user.createMany({ data: users });
  console.log(`✅ Created ${count} users`);
  return users;
}

async function generateBrands(users: any[], count: number = 30) {
  console.log(`🔄 Generating ${count} brands...`);

  const brands = [];
  for (let i = 0; i < count; i++) {
    const brandName = getRandomItem(CLOTHING_BRANDS);
    const owner = getRandomItem(users);

    brands.push({
      id: faker.string.uuid(),
      name: `${brandName} ${faker.string.alpha(3).toUpperCase()}`, // Make unique
      description: faker.company.buzzPhrase(),
      logoUrl: faker.image.url({ width: 200, height: 200 }),
      contactAddress: faker.location.streetAddress(),
      businessPhoneNumber: faker.phone.number('+234-###-###-####'),
      ownerId: owner.id,
      status: getRandomItem(['PENDING', 'VERIFIED', 'REJECTED', 'DRAFT']),
      verificationNotes: faker.datatype.boolean({ probability: 0.3 }) ? faker.lorem.sentence() : null,
      verifiedAt: faker.datatype.boolean({ probability: 0.7 }) ? faker.date.recent() : null,
      verifiedBy: faker.datatype.boolean({ probability: 0.7 }) ? faker.string.uuid() : null,
    });
  }

  await prisma.brand.createMany({ data: brands });
  console.log(`✅ Created ${count} brands`);
  return brands;
}

async function generateCategories() {
  console.log('🔄 Generating categories...');

  const categories = CLOTHING_CATEGORIES.map(name => ({
    id: faker.string.uuid(),
    name
  }));

  await prisma.category.createMany({ data: categories });
  console.log(`✅ Created ${categories.length} categories`);
  return categories;
}

async function generateTags() {
  console.log('🔄 Generating tags...');

  const tags = CLOTHING_TAGS.map(name => ({
    id: faker.string.uuid(),
    name
  }));

  await prisma.tag.createMany({ data: tags });
  console.log(`✅ Created ${tags.length} tags`);
  return tags;
}

async function generateProducts(users: any[], brands: any[], count: number = 500) {
  console.log(`🔄 Generating ${count} products...`);

  const products = [];
  for (let i = 0; i < count; i++) {
    const seller = getRandomItem(users);
    const brand = faker.datatype.boolean({ probability: 0.8 }) ? getRandomItem(brands) : null;
    const basePrice = faker.number.float({ min: 5000, max: 150000, multipleOf: 100 });

    products.push({
      id: faker.string.uuid(),
      sellerId: seller.id,
      title: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      basePrice: basePrice,
      discountPercent: faker.datatype.boolean({ probability: 0.3 }) ?
          faker.number.float({ min: 5, max: 50 }) : null,
      status: getRandomItem(['DRAFT', 'ACTIVE', 'SOLD', 'DELETED']),
      condition: getRandomItem(['NEW', 'OPEN_BOX', 'LIKE_NEW', 'LIGHTLY_USED', 'FAIRLY_USED', 'HEAVILY_USED']),
      size: getRandomItem(SIZES),
      gender: getRandomItem(['MEN', 'WOMEN', 'UNISEX']),
      color: getRandomItem(COLORS),
      brandId: brand?.id || null,
      isAvailable: faker.datatype.boolean({ probability: 0.85 }),
    });
  }

  await prisma.product.createMany({ data: products });
  console.log(`✅ Created ${count} products`);
  return products;
}

async function generateProductImages(products: any[], categories: any[]) {
  console.log('🔄 Generating product images with Unsplash URLs...');

  const images = [];

  // Create a map of product categories for quick lookup
  const productCategories = await prisma.categoriesOnProducts.findMany({
    include: { category: true }
  });

  const productCategoryMap = new Map();
  productCategories.forEach(pc => {
    if (!productCategoryMap.has(pc.productId)) {
      productCategoryMap.set(pc.productId, []);
    }
    productCategoryMap.get(pc.productId).push(pc.category.name);
  });

  for (const product of products) {
    const imageCount = faker.number.int({ min: 1, max: 4 });
    const productCats = productCategoryMap.get(product.id) || ['General'];
    const productImages = getProductImages(productCats, product.gender, imageCount);

    for (let i = 0; i < productImages.length; i++) {
      images.push({
        id: faker.string.uuid(),
        url: productImages[i],
        productId: product.id,
        order: i,
      });
    }
  }

  await prisma.productImage.createMany({ data: images });
  console.log(`✅ Created ${images.length} product images with Unsplash URLs`);
}

async function generateProductRelationships(products: any[], categories: any[], tags: any[]) {
  console.log('🔄 Generating product relationships...');

  // Product Categories
  const productCategories = [];
  for (const product of products) {
    const categoryCount = faker.number.int({ min: 1, max: 3 });
    const selectedCategories = getRandomItems(categories, categoryCount);

    for (const category of selectedCategories) {
      productCategories.push({
        productId: product.id,
        categoryId: category.id,
      });
    }
  }

  await prisma.categoriesOnProducts.createMany({ data: productCategories });
  console.log(`✅ Created ${productCategories.length} product-category relationships`);

  // Product Tags
  const productTags = [];
  for (const product of products) {
    const tagCount = faker.number.int({ min: 1, max: 5 });
    const selectedTags = getRandomItems(tags, tagCount);

    for (const tag of selectedTags) {
      productTags.push({
        productId: product.id,
        tagId: tag.id,
      });
    }
  }

  await prisma.tagsOnProducts.createMany({ data: productTags });
  console.log(`✅ Created ${productTags.length} product-tag relationships`);
}

async function generateUserInteractions(users: any[], products: any[]) {
  console.log('🔄 Generating user interactions...');

  // Follows
  const follows = [];
  for (let i = 0; i < 200; i++) {
    const follower = getRandomItem(users);
    const following = getRandomItem(users.filter(u => u.id !== follower.id));

    follows.push({
      id: faker.string.uuid(),
      followerId: follower.id,
      followingId: following.id,
    });
  }

  await prisma.follow.createMany({
    data: follows,
    skipDuplicates: true
  });
  console.log(`✅ Created follows`);

  // Likes
  const likes = [];
  for (let i = 0; i < 800; i++) {
    const user = getRandomItem(users);
    const product = getRandomItem(products);

    likes.push({
      id: faker.string.uuid(),
      userId: user.id,
      productId: product.id,
    });
  }

  await prisma.like.createMany({
    data: likes,
    skipDuplicates: true
  });
  console.log(`✅ Created likes`);

  // Reviews
  const reviews = [];
  for (let i = 0; i < 300; i++) {
    const user = getRandomItem(users);
    const product = getRandomItem(products);

    reviews.push({
      id: faker.string.uuid(),
      rating: faker.number.int({ min: 1, max: 5 }),
      description: faker.datatype.boolean({ probability: 0.7 }) ?
          faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })) : null,
      userId: user.id,
      productId: product.id,
    });
  }

  await prisma.review.createMany({ data: reviews });
  console.log(`✅ Created ${reviews.length} reviews`);
}

async function generateAddresses(users: any[]) {
  console.log('🔄 Generating addresses...');

  const addresses = [];
  for (const user of users) {
    const addressCount = faker.number.int({ min: 1, max: 3 });
    for (let i = 0; i < addressCount; i++) {
      addresses.push({
        id: faker.string.uuid(),
        userId: user.id,
        type: getRandomItem(['BILLING', 'SHIPPING']),
        street: faker.location.streetAddress(),
        city: getRandomItem(NIGERIAN_CITIES),
        state: getRandomItem(NIGERIAN_STATES),
        country: 'Nigeria',
        zipCode: faker.location.zipCode('#####'),
        isDefault: i === 0,
      });
    }
  }

  await prisma.address.createMany({ data: addresses });
  console.log(`✅ Created ${addresses.length} addresses`);
  return addresses;
}

async function generateWallets(users: any[]) {
  console.log('🔄 Generating wallets...');

  const wallets = users.map(user => ({
    id: faker.string.uuid(),
    userId: user.id,
    balance: faker.number.int({ min: 0, max: 500000 }), // In kobo
  }));

  await prisma.wallet.createMany({ data: wallets });
  console.log(`✅ Created ${wallets.length} wallets`);
  return wallets;
}

async function generateOrders(users: any[], products: any[], addresses: any[]) {
  console.log('🔄 Generating orders...');

  const orders = [];
  const orderItems = [];

  for (let i = 0; i < 150; i++) {
    const buyer = getRandomItem(users);
    const userAddresses = addresses.filter(a => a.userId === buyer.id);
    const address = getRandomItem(userAddresses);

    if (!address) continue;

    const orderId = faker.string.uuid();
    const itemCount = faker.number.int({ min: 1, max: 4 });
    const selectedProducts = getRandomItems(products, itemCount);

    let totalAmount = 0;

    for (const product of selectedProducts) {
      const quantity = faker.number.int({ min: 1, max: 2 });
      const price = faker.number.float({
        min: Number(product.basePrice) * 0.8,
        max: Number(product.basePrice) * 1.2,
        multipleOf: 100
      });

      totalAmount += price * quantity;

      orderItems.push({
        id: faker.string.uuid(),
        orderId,
        productId: product.id,
        quantity,
        price,
      });
    }

    // Create order
    orders.push({
      id: orderId,
      buyerId: buyer.id,
      status: getRandomItem(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
      isBundle: selectedProducts.length > 1,
      totalAmount,
      discountCode: faker.datatype.boolean({ probability: 0.2 }) ? faker.string.alpha(8).toUpperCase() : null,
      addressId: address.id,
    });
  }

  // Create all records
  await prisma.order.createMany({ data: orders });
  await prisma.orderItem.createMany({ data: orderItems });

  console.log(`✅ Created ${orders.length} orders with ${orderItems.length} items`);

  return { orders };
}

async function generateConversationsAndMessages(users: any[], products: any[]) {
  console.log('🔄 Generating conversations and messages...');

  const conversations = [];
  const messages = [];
  const usedPairs = new Set();

  let attemptCount = 0;
  const maxAttempts = 200;

  while (conversations.length < 80 && attemptCount < maxAttempts) {
    const memberOne = getRandomItem(users);
    const memberTwo = getRandomItem(users.filter(u => u.id !== memberOne.id));

    // Create a consistent pair key (always put smaller ID first)
    const pairKey = [memberOne.id, memberTwo.id].sort().join('-');

    if (!usedPairs.has(pairKey)) {
      usedPairs.add(pairKey);

      const conversationId = faker.string.uuid();
      conversations.push({
        id: conversationId,
        memberOneId: memberOne.id,
        memberTwoId: memberTwo.id,
      });

      // Generate messages for this conversation
      const messageCount = faker.number.int({ min: 2, max: 15 });
      for (let j = 0; j < messageCount; j++) {
        const sender = faker.datatype.boolean() ? memberOne : memberTwo;

        messages.push({
          id: faker.string.uuid(),
          content: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
          fileUrl: faker.datatype.boolean({ probability: 0.1 }) ? faker.image.url() : null,
          senderId: sender.id,
          conversationId,
          productId: faker.datatype.boolean({ probability: 0.3 }) ? getRandomItem(products).id : null,
          isRead: faker.datatype.boolean({ probability: 0.7 }),
        });
      }
    }

    attemptCount++;
  }

  if (conversations.length > 0) {
    await prisma.conversation.createMany({ data: conversations });
    await prisma.message.createMany({ data: messages });
  }

  console.log(`✅ Created ${conversations.length} conversations with ${messages.length} messages`);
}

async function generateNotifications(users: any[]) {
  console.log('🔄 Generating notifications...');

  const notifications = [];
  const notificationTypes = [
    'PRODUCT_SOLD', 'NEW_FOLLOWER', 'NEW_MESSAGE', 'ORDER_STATUS',
    'NEW_PRODUCT_FROM_FOLLOWING', 'PRICE_DROP', 'BRAND_VERIFICATION_STATUS'
  ];

  for (let i = 0; i < 400; i++) {
    const user = getRandomItem(users);
    const type = getRandomItem(notificationTypes);

    let content = '';
    switch (type) {
      case 'PRODUCT_SOLD':
        content = 'Your product has been sold!';
        break;
      case 'NEW_FOLLOWER':
        content = `${faker.person.firstName()} started following you`;
        break;
      case 'NEW_MESSAGE':
        content = 'You have a new message';
        break;
      case 'ORDER_STATUS':
        content = 'Your order status has been updated';
        break;
      case 'NEW_PRODUCT_FROM_FOLLOWING':
        content = `${faker.person.firstName()} posted a new product`;
        break;
      case 'PRICE_DROP':
        content = 'Price dropped on a product you liked';
        break;
      case 'BRAND_VERIFICATION_STATUS':
        content = 'Your brand verification status has been updated';
        break;
    }

    notifications.push({
      id: faker.string.uuid(),
      userId: user.id,
      type,
      content,
      isRead: faker.datatype.boolean({ probability: 0.6 }),
    });
  }

  await prisma.notification.createMany({ data: notifications });
  console.log(`✅ Created ${notifications.length} notifications`);
}

async function generateDiscountCodes() {
  console.log('🔄 Generating discount codes...');

  const discountCodes = [];
  for (let i = 0; i < 20; i++) {
    discountCodes.push({
      id: faker.string.uuid(),
      code: faker.string.alpha({ length: 8, casing: 'upper' }),
      percentage: faker.number.float({ min: 5, max: 50 }),
      validFrom: faker.date.recent({ days: 30 }),
      validUntil: faker.date.future({ years: 1 }),
      maxUses: faker.datatype.boolean({ probability: 0.7 }) ? faker.number.int({ min: 10, max: 1000 }) : null,
      usedCount: faker.number.int({ min: 0, max: 50 }),
      isActive: faker.datatype.boolean({ probability: 0.8 }),
    });
  }

  await prisma.discountCode.createMany({ data: discountCodes });
  console.log(`✅ Created ${discountCodes.length} discount codes`);
}

async function main() {
  console.log('🚀 Starting database seeding...');

  try {
    // Clean existing data (optional)
    console.log('🧹 Cleaning existing data...');

    // Delete in correct order to handle foreign key constraints
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.review.deleteMany();
    await prisma.like.deleteMany();
    await prisma.tagsOnProducts.deleteMany();
    await prisma.categoriesOnProducts.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.productView.deleteMany();
    await prisma.product.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.savedCard.deleteMany();
    await prisma.address.deleteMany();
    await prisma.brandCertification.deleteMany();
    await prisma.brand.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.category.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.wsToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.discountCode.deleteMany();

    console.log('✅ Cleaned existing data');

    // Generate base entities
    const users = await generateUsers(100);
    const brands = await generateBrands(users, 30);
    const categories = await generateCategories();
    const tags = await generateTags();

    // Generate wallets for all users
    await generateWallets(users);

    // Generate products and related data
    const products = await generateProducts(users, brands, 500);
    await generateProductRelationships(products, categories, tags);
    await generateProductImages(products, categories);

    // Generate user interactions
    await generateUserInteractions(users, products);

    // Generate addresses and orders
    const addresses = await generateAddresses(users);
    const { orders } = await generateOrders(users, products, addresses);

    // Generate communications
    await generateConversationsAndMessages(users, products);
    await generateNotifications(users);

    // Generate additional features
    await generateDiscountCodes();

    console.log('✅ Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Brands: ${brands.length}`);
    console.log(`   - Categories: ${categories.length}`);
    console.log(`   - Tags: ${tags.length}`);
    console.log(`   - Products: ${products.length}`);
    console.log(`   - Orders: ${orders.length}`);
    console.log(`   - Wallets: ${users.length}`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default main;
