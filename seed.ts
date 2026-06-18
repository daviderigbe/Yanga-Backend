import {
  AddressType,
  BrandStatus,
  Condition,
  DeliveryStatus,
  DispatchProvider,
  Gender,
  NotificationType,
  OrderActivityType,
  OrderStatus,
  Prisma,
  PrismaClient,
  ProductStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const COMMISSION_RATE = 0.1;
const SERVICE_FEE_NAIRA = 200;
const DELIVERY_MARKUP_NAIRA = 0;

const LAGOS_AREAS = [
  {
    area: "Lekki Phase 1",
    street: "Admiralty Way",
    latitude: 6.4474,
    longitude: 3.4541,
  },
  {
    area: "Yaba",
    street: "Herbert Macaulay Way",
    latitude: 6.5158,
    longitude: 3.3707,
  },
  {
    area: "Victoria Island",
    street: "Akin Adesola Street",
    latitude: 6.4281,
    longitude: 3.4219,
  },
  {
    area: "Ikeja GRA",
    street: "Isaac John Street",
    latitude: 6.5886,
    longitude: 3.3568,
  },
  {
    area: "Surulere",
    street: "Bode Thomas Street",
    latitude: 6.5012,
    longitude: 3.3581,
  },
  {
    area: "Ikoyi",
    street: "Awolowo Road",
    latitude: 6.4549,
    longitude: 3.4246,
  },
  {
    area: "Ajah",
    street: "Addo Road",
    latitude: 6.4698,
    longitude: 3.5852,
  },
  {
    area: "Gbagada",
    street: "Diya Street",
    latitude: 6.5573,
    longitude: 3.3841,
  },
  {
    area: "Ogudu",
    street: "Ogudu Road",
    latitude: 6.5792,
    longitude: 3.3974,
  },
  {
    area: "Maryland",
    street: "Mobolaji Bank Anthony Way",
    latitude: 6.5721,
    longitude: 3.3673,
  },
];

const SELLERS = [
  {
    name: "Amara Okonkwo",
    userName: "amara.archive",
    email: "amara.seller@afrab.test",
    shop: "Amara Archive",
    bio: "Curated occasionwear, silk separates, and polished Lagos evening pieces.",
    areaIndex: 0,
  },
  {
    name: "Teni Balogun",
    userName: "teni.threadhouse",
    email: "teni.seller@afrab.test",
    shop: "Threadhouse Lagos",
    bio: "Sharp everyday staples, denim, and clean basics for city wardrobes.",
    areaIndex: 1,
  },
  {
    name: "Kamsi Nwosu",
    userName: "kamsi.studio",
    email: "kamsi.seller@afrab.test",
    shop: "Kamsi Studio",
    bio: "Minimal womenswear with warm tailoring and rich neutral tones.",
    areaIndex: 2,
  },
  {
    name: "Damilare Cole",
    userName: "dami.market",
    email: "dami.seller@afrab.test",
    shop: "Cole Market",
    bio: "Menswear, sneakers, utility jackets, and weekend-ready essentials.",
    areaIndex: 3,
  },
  {
    name: "Zainab Bello",
    userName: "zainab.collective",
    email: "zainab.seller@afrab.test",
    shop: "Zee Collective",
    bio: "Accessories, statement bags, sunglasses, and playful finishing pieces.",
    areaIndex: 4,
  },
  {
    name: "Ifeanyi Eze",
    userName: "ifeanyi.lane",
    email: "ifeanyi.seller@afrab.test",
    shop: "Ifeanyi Lane",
    bio: "Premium pre-loved designer finds and elevated streetwear.",
    areaIndex: 5,
  },
  {
    name: "Moyo Adebayo",
    userName: "moyo.edit",
    email: "moyo.seller@afrab.test",
    shop: "Moyo Edit",
    bio: "Fresh drops for brunch, beach days, and easy Lagos nights.",
    areaIndex: 6,
  },
  {
    name: "Nora Osagie",
    userName: "nora.room",
    email: "nora.seller@afrab.test",
    shop: "Nora Room",
    bio: "Soft tailoring, workwear, and refined wardrobe updates.",
    areaIndex: 7,
  },
];

const BUYERS = [
  ["Chioma Adeyemi", "chioma.buyer", "chioma.buyer@afrab.test", 8],
  ["Kunle Sanni", "kunle.buyer", "kunle.buyer@afrab.test", 9],
  ["Dara Williams", "dara.buyer", "dara.buyer@afrab.test", 0],
  ["Tobi Lawal", "tobi.buyer", "tobi.buyer@afrab.test", 1],
  ["Ebele Udo", "ebele.buyer", "ebele.buyer@afrab.test", 2],
  ["Seyi Martins", "seyi.buyer", "seyi.buyer@afrab.test", 3],
] as const;

const CATEGORIES = [
  "Dresses",
  "Tops",
  "Shirts",
  "Pants",
  "Denim",
  "Outerwear",
  "Shoes",
  "Bags",
  "Accessories",
  "Jewelry",
  "Sunglasses",
  "Workwear",
  "Eveningwear",
  "Streetwear",
];

const TAGS = [
  "new-arrival",
  "editor-pick",
  "lagos-ready",
  "minimal",
  "streetwear",
  "occasionwear",
  "workwear",
  "designer",
  "vintage",
  "sustainable",
  "party",
  "travel",
  "weekend",
  "premium",
  "under-25000",
];

type ProductSeed = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  image: string;
  price: number;
  discount?: number;
  condition: Condition;
  size: string;
  gender: Gender;
  color: string;
  quantity: number;
};

const PRODUCT_CATALOG: ProductSeed[] = [
  {
    title: "Ivory Linen Wrap Dress",
    description: "A breathable linen wrap dress with soft waist shaping and a clean brunch-ready finish.",
    category: "Dresses",
    tags: ["editor-pick", "lagos-ready", "weekend"],
    image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&h=1100&fit=crop&crop=faces",
    price: 32000,
    discount: 10,
    condition: Condition.LIKE_NEW,
    size: "M",
    gender: Gender.WOMEN,
    color: "Ivory",
    quantity: 2,
  },
  {
    title: "Black Satin Slip Dress",
    description: "Sleek satin slip dress with adjustable straps, perfect for dinner plans and easy layering.",
    category: "Eveningwear",
    tags: ["party", "occasionwear", "minimal"],
    image: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=900&h=1100&fit=crop&crop=faces",
    price: 41000,
    condition: Condition.LIGHTLY_USED,
    size: "S",
    gender: Gender.WOMEN,
    color: "Black",
    quantity: 1,
  },
  {
    title: "Cropped White Oxford Shirt",
    description: "Crisp white cotton shirt with a cropped hem and structured collar.",
    category: "Shirts",
    tags: ["workwear", "minimal", "new-arrival"],
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&h=1100&fit=crop&crop=center",
    price: 18500,
    condition: Condition.NEW,
    size: "M",
    gender: Gender.UNISEX,
    color: "White",
    quantity: 4,
  },
  {
    title: "Wide-Leg Indigo Denim",
    description: "Relaxed wide-leg denim with a deep indigo wash and high waist fit.",
    category: "Denim",
    tags: ["weekend", "sustainable", "under-25000"],
    image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=900&h=1100&fit=crop&crop=center",
    price: 24000,
    condition: Condition.LIKE_NEW,
    size: "30",
    gender: Gender.WOMEN,
    color: "Indigo",
    quantity: 2,
  },
  {
    title: "Olive Utility Jacket",
    description: "Lightweight utility jacket with roomy pockets and an easy boxy shape.",
    category: "Outerwear",
    tags: ["streetwear", "travel", "editor-pick"],
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900&h=1100&fit=crop&crop=faces",
    price: 36000,
    condition: Condition.OPEN_BOX,
    size: "L",
    gender: Gender.UNISEX,
    color: "Olive",
    quantity: 1,
  },
  {
    title: "Salvatore Ferragamo bag",
    description: "red Salvatore Ferragamo bag features a structured silhouette with a distinctive silver-toned Gancini clasp.",
    category: "Bags",
    tags: ["premium", "workwear", "designer"],
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&h=1100&fit=crop&crop=center",
    price: 58000,
    discount: 8,
    condition: Condition.LIGHTLY_USED,
    size: "OS",
    gender: Gender.WOMEN,
    color: "Tan",
    quantity: 2,
  },
  {
    title: "Gold Dome Hoop Earrings",
    description: "Polished gold-tone dome hoops that add a clean statement to everyday looks.",
    category: "Jewelry",
    tags: ["party", "editor-pick", "under-25000"],
    image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&h=1100&fit=crop&crop=center",
    price: 14500,
    condition: Condition.NEW,
    size: "OS",
    gender: Gender.WOMEN,
    color: "Gold",
    quantity: 5,
  },
  {
    title: "Matte Black Rayban Sunglasses",
    description: "Angular black sunglasses with tinted lenses and a sturdy everyday frame.",
    category: "Sunglasses",
    tags: ["weekend", "travel", "under-25000"],
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=900&h=1100&fit=crop&crop=center",
    price: 17000,
    condition: Condition.LIKE_NEW,
    size: "OS",
    gender: Gender.UNISEX,
    color: "Black",
    quantity: 3,
  },
  {
    title: "Navy Resort Camp Shirt",
    description: "Soft short-sleeve camp shirt with a relaxed collar and vacation-weight drape.",
    category: "Shirts",
    tags: ["weekend", "lagos-ready", "travel"],
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=900&h=1100&fit=crop&crop=faces",
    price: 22500,
    condition: Condition.NEW,
    size: "L",
    gender: Gender.MEN,
    color: "Navy",
    quantity: 3,
  },
  {
    title: "Relaxed Stone Chinos",
    description: "Straight-leg stone chinos with a neat taper and soft brushed cotton finish.",
    category: "Pants",
    tags: ["workwear", "minimal", "weekend"],
    image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=900&h=1100&fit=crop&crop=center",
    price: 28500,
    condition: Condition.LIGHTLY_USED,
    size: "34",
    gender: Gender.MEN,
    color: "Stone",
    quantity: 2,
  },
  {
    title: "Cream Knit Polo",
    description: "Textured knit polo in a warm cream tone with ribbed cuffs and collar.",
    category: "Tops",
    tags: ["premium", "minimal", "new-arrival"],
    image: "https://images.unsplash.com/photo-1603252109303-2751441dd157?w=900&h=1100&fit=crop&crop=faces",
    price: 33000,
    discount: 12,
    condition: Condition.OPEN_BOX,
    size: "M",
    gender: Gender.MEN,
    color: "Cream",
    quantity: 1,
  },
  {
    title: "Nike Air Force 1 Low Carhartt WIP sneakers",
    description: "Nike Air Force 1 Low Carhartt WIP sneakers, featuring a durable brown canvas upper and a wool-lined interior..",
    category: "Shoes",
    tags: ["streetwear", "weekend", "editor-pick"],
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900&h=1100&fit=crop&crop=center",
    price: 46000,
    condition: Condition.LIGHTLY_USED,
    size: "42",
    gender: Gender.UNISEX,
    color: "Brown",
    quantity: 1,
  },
  {
    title: "Blue plaid flannel three-piece suit",
    description: "Blue plaid flannel three-piece suit features a dapper professional style paired with a striped tie.",
    category: "Workwear",
    tags: ["workwear", "premium", "occasionwear"],
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=900&h=1100&fit=crop&crop=faces",
    price: 69000,
    condition: Condition.LIKE_NEW,
    size: "L",
    gender: Gender.MEN,
    color: "Blue",
    quantity: 1,
  },
  {
    title: "high-waisted denim jeans and a graphic t-shirt",
    description: "high-waisted denim jeans and a graphic t-shirt.",
    category: "Dresses",
    tags: ["party", "occasionwear", "lagos-ready"],
    image: "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=900&h=1100&fit=crop&crop=center",
    price: 27000,
    condition: Condition.FAIRLY_USED,
    size: "M",
    gender: Gender.WOMEN,
    color: "Blue and Black",
    quantity: 2,
  },
  {
    title: "Light blue crew-neck t-shirt.",
    description: "Light blue crew-neck t-shirt.",
    category: "Tops",
    tags: ["weekend", "minimal", "under-25000"],
    image: "https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?w=900&h=1100&fit=crop&crop=faces",
    price: 21500,
    condition: Condition.NEW,
    size: "S",
    gender: Gender.WOMEN,
    color: "Light Blue",
    quantity: 3,
  },
  {
    title: "Black Levele backpack",
    description: "black Levele backpack features a minimalist design with a small yellow logo tag on the front pocket.",
    category: "Bags",
    tags: ["designer", "premium", "travel"],
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&h=1100&fit=crop&crop=center",
    price: 74000,
    condition: Condition.LIGHTLY_USED,
    size: "OS",
    gender: Gender.UNISEX,
    color: "Black",
    quantity: 1,
  },
  {
    title: "Silver Mesh Watch",
    description: "Minimal silver watch with mesh strap and slim round face.",
    category: "Accessories",
    tags: ["workwear", "premium", "minimal"],
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&h=1100&fit=crop&crop=center",
    price: 39000,
    condition: Condition.LIKE_NEW,
    size: "OS",
    gender: Gender.UNISEX,
    color: "Silver",
    quantity: 1,
  },
  {
    title: "Red Bias-Cut Party Dress",
    description: "Bold red bias-cut dress with a flattering drape and subtle side slit.",
    category: "Eveningwear",
    tags: ["party", "occasionwear", "new-arrival"],
    image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=900&h=1100&fit=crop&crop=faces",
    price: 52000,
    discount: 15,
    condition: Condition.OPEN_BOX,
    size: "M",
    gender: Gender.WOMEN,
    color: "Red",
    quantity: 1,
  },
  {
    title: "Black N2P shirt",
    description: "N2P shirt",
    category: "Streetwear",
    tags: ["streetwear", "travel", "weekend", "new-arrival"],
    image: "https://afrab-uploaded-files-v1.s3.eu-north-1.amazonaws.com/products/1762419770854-dcd472b54e14b04b.png",
    price: 31000,
    condition: Condition.LIKE_NEW,
    size: "M",
    gender: Gender.UNISEX,
    color: "Black",
    quantity: 8,
  },
  {
    title: "Aldo high-heeled pumps",
    description: "Aldo high-heeled pumps featuring a vibrant blue floral pattern.",
    category: "Shoes",
    tags: ["workwear", "minimal", "premium"],
    image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900&h=1100&fit=crop&crop=center",
    price: 36500,
    condition: Condition.LIGHTLY_USED,
    size: "39",
    gender: Gender.WOMEN,
    color: "Taupe",
    quantity: 1,
  },
];

function id(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

function phone(index: number) {
  return `080${String(70000000 + index * 13729).slice(0, 8)}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function addressFor(userId: string, type: AddressType, areaIndex: number, suite: string, isDefault = true) {
  const location = LAGOS_AREAS[areaIndex % LAGOS_AREAS.length];

  return {
    id: id(`address-${type.toLowerCase()}`, Number(userId.split("-").at(-1)) || areaIndex),
    userId,
    type,
    street: `${suite}, ${location.street}`,
    city: location.area,
    state: "Lagos",
    country: "Nigeria",
    zipCode: "100001",
    contactName: undefined as string | undefined,
    contactPhone: undefined as string | undefined,
    landmark: `${location.area} bus stop`,
    deliveryInstructions: type === AddressType.PICKUP ? "Call seller before pickup." : "Call on arrival.",
    latitude: new Prisma.Decimal(location.latitude),
    longitude: new Prisma.Decimal(location.longitude),
    isDefault,
  };
}

function productPrice(product: ProductSeed) {
  return roundMoney(product.price * (1 - (product.discount || 0) / 100));
}

function calculateFees(subtotal: number, providerDeliveryFee: number) {
  const commissionAmount = roundMoney(subtotal * COMMISSION_RATE);
  const deliveryMarkup = DELIVERY_MARKUP_NAIRA;
  const deliveryFee = roundMoney(providerDeliveryFee + deliveryMarkup);
  const serviceFee = SERVICE_FEE_NAIRA;
  const sellerPayoutAmount = roundMoney(subtotal - commissionAmount);
  const platformRevenueAmount = roundMoney(commissionAmount + serviceFee + deliveryMarkup);
  const totalAmount = roundMoney(subtotal + deliveryFee + serviceFee);

  return {
    providerDeliveryFee,
    deliveryMarkup,
    deliveryFee,
    serviceFee,
    commissionAmount,
    sellerPayoutAmount,
    platformRevenueAmount,
    totalAmount,
  };
}

async function cleanDatabase() {
  console.log("Cleaning existing marketplace data...");

  await prisma.shipmentEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderActivity.deleteMany();
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
}

async function seedUsers() {
  const passwordHash = await Bun.password.hash("Password123!");
  const sellers = SELLERS.map((seller, index) => {
    const [firstName, lastName] = seller.name.split(" ");
    return {
      id: id("seller", index),
      email: seller.email,
      emailVerified: true,
      password: passwordHash,
      name: seller.name,
      imageUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seller.name)}&backgroundColor=111827,7c3aed,0f766e`,
      bio: seller.bio,
      userName: seller.userName,
      bankCode: ["044", "057", "058", "011"][index % 4],
      bankName: ["Access Bank", "Zenith Bank", "GTBank", "First Bank"][index % 4],
      bankAccountName: seller.name,
      bankAccountNumber: `20${String(10000000 + index * 91357).slice(0, 8)}`,
      recipientCode: `RCP_SELLER_${String(index + 1).padStart(3, "0")}`,
      isDeactivated: false,
      deactivatedAt: null,
      googleId: null,
      appleId: null,
      enableBundleBuying: true,
      userUnavailable: false,
    };
  });

  const buyers = BUYERS.map(([name, userName, email], index) => ({
    id: id("buyer", index),
    email,
    emailVerified: true,
    password: passwordHash,
    name,
    imageUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=f97316,0ea5e9,16a34a`,
    bio: "Testing AFRA B marketplace checkout, saved addresses, and order tracking.",
    userName,
    bankCode: null,
    bankName: null,
    bankAccountName: null,
    bankAccountNumber: null,
    recipientCode: null,
    isDeactivated: false,
    deactivatedAt: null,
    googleId: null,
    appleId: null,
    enableBundleBuying: false,
    userUnavailable: false,
  }));

  await prisma.user.createMany({ data: [...sellers, ...buyers] });
  return { sellers, buyers };
}

async function seedAddresses(sellers: Awaited<ReturnType<typeof seedUsers>>["sellers"], buyers: Awaited<ReturnType<typeof seedUsers>>["buyers"]) {
  const addresses: Prisma.AddressCreateManyInput[] = [];

  sellers.forEach((seller, index) => {
    const pickup = addressFor(seller.id, AddressType.PICKUP, SELLERS[index].areaIndex, `${SELLERS[index].shop} Pickup Desk`);
    pickup.contactName = seller.name;
    pickup.contactPhone = phone(index + 1);
    addresses.push(pickup);

    const shipping = addressFor(seller.id, AddressType.SHIPPING, SELLERS[index].areaIndex, `${SELLERS[index].shop} Office`, false);
    shipping.id = id("address-seller-shipping", index);
    shipping.contactName = seller.name;
    shipping.contactPhone = phone(index + 20);
    addresses.push(shipping);
  });

  buyers.forEach((buyer, index) => {
    const [, , , areaIndex] = BUYERS[index];
    const shipping = addressFor(buyer.id, AddressType.SHIPPING, areaIndex, `Flat ${index + 2}, ${LAGOS_AREAS[areaIndex].street}`);
    shipping.id = id("address-buyer-shipping", index);
    shipping.contactName = buyer.name || undefined;
    shipping.contactPhone = phone(index + 40);
    addresses.push(shipping);

    const billing = addressFor(buyer.id, AddressType.BILLING, areaIndex, `Billing Suite ${index + 1}`, false);
    billing.id = id("address-buyer-billing", index);
    billing.contactName = buyer.name || undefined;
    billing.contactPhone = phone(index + 50);
    addresses.push(billing);
  });

  await prisma.address.createMany({ data: addresses });
  return addresses;
}

async function seedBrands(sellers: Awaited<ReturnType<typeof seedUsers>>["sellers"]) {
  const brands = sellers.map((seller, index) => ({
    id: id("brand", index),
    name: SELLERS[index].shop,
    description: SELLERS[index].bio,
    logoUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(SELLERS[index].shop)}&backgroundColor=f8fafc`,
    contactAddress: `${SELLERS[index].shop} Pickup Desk, ${LAGOS_AREAS[SELLERS[index].areaIndex].street}, Lagos`,
    businessPhoneNumber: phone(index + 1),
    ownerId: seller.id,
    status: BrandStatus.VERIFIED,
    verificationNotes: "Verified Lagos marketplace seller for testing.",
    verifiedAt: new Date("2026-05-20T10:00:00.000Z"),
    verifiedBy: "seed-admin",
  }));

  await prisma.brand.createMany({ data: brands });
  return brands;
}

async function seedTaxonomy() {
  const categories = CATEGORIES.map((name, index) => ({ id: id("category", index), name }));
  const tags = TAGS.map((name, index) => ({ id: id("tag", index), name }));

  await prisma.category.createMany({ data: categories });
  await prisma.tag.createMany({ data: tags });
  return { categories, tags };
}

async function seedProducts(
  sellers: Awaited<ReturnType<typeof seedUsers>>["sellers"],
  brands: Awaited<ReturnType<typeof seedBrands>>,
  categories: Awaited<ReturnType<typeof seedTaxonomy>>["categories"],
  tags: Awaited<ReturnType<typeof seedTaxonomy>>["tags"],
) {
  const products = PRODUCT_CATALOG.map((product, index) => {
    const sellerIndex = index % sellers.length;
    return {
      id: id("product", index),
      sellerId: sellers[sellerIndex].id,
      title: product.title,
      description: product.description,
      basePrice: product.price,
      discountPercent: product.discount || null,
      status: ProductStatus.ACTIVE,
      condition: product.condition,
      size: product.size,
      gender: product.gender,
      color: product.color,
      brandId: brands[sellerIndex].id,
      quantity: product.quantity,
      isAvailable: true,
    };
  });

  await prisma.product.createMany({ data: products });

  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));
  const tagByName = new Map(tags.map((tag) => [tag.name, tag.id]));
  const categoryLinks: Prisma.CategoriesOnProductsCreateManyInput[] = [];
  const tagLinks: Prisma.TagsOnProductsCreateManyInput[] = [];
  const images: Prisma.ProductImageCreateManyInput[] = [];

  PRODUCT_CATALOG.forEach((product, index) => {
    const productId = products[index].id;
    categoryLinks.push({
      productId,
      categoryId: categoryByName.get(product.category) || categories[0].id,
    });

    product.tags.forEach((tagName) => {
      const tagId = tagByName.get(tagName);
      if (tagId) tagLinks.push({ productId, tagId });
    });

    images.push({
      id: id("image", index),
      productId,
      url: product.image,
      order: 0,
    });
    images.push({
      id: id("image-detail", index),
      productId,
      url: `${product.image}&sat=-10`,
      order: 1,
    });
  });

  await prisma.categoriesOnProducts.createMany({ data: categoryLinks, skipDuplicates: true });
  await prisma.tagsOnProducts.createMany({ data: tagLinks, skipDuplicates: true });
  await prisma.productImage.createMany({ data: images });
  return products;
}

async function seedWallets(users: { id: string }[]) {
  await prisma.wallet.createMany({
    data: users.map((user, index) => ({
      id: id("wallet", index),
      userId: user.id,
      balance: index < SELLERS.length ? 250000 + index * 75000 : 0,
    })),
  });
}

async function seedSocialProof(users: { id: string }[], products: { id: string; sellerId: string }[]) {
  const likes: Prisma.LikeCreateManyInput[] = [];
  const reviews: Prisma.ReviewCreateManyInput[] = [];
  const views: Prisma.ProductViewCreateManyInput[] = [];

  products.forEach((product, productIndex) => {
    users.forEach((user, userIndex) => {
      if (user.id !== product.sellerId && (productIndex + userIndex) % 3 === 0) {
        likes.push({ id: id("like", likes.length), userId: user.id, productId: product.id });
      }

      if (user.id !== product.sellerId && (productIndex + userIndex) % 7 === 0) {
        reviews.push({
          id: id("review", reviews.length),
          userId: user.id,
          productId: product.id,
          rating: 4 + ((productIndex + userIndex) % 2),
          description: [
            "Looks exactly like the photos and feels carefully packed.",
            "Great seller communication and the fit was accurate.",
            "Quality piece for the price. Would buy from this seller again.",
            "Clean condition, fast dispatch, and lovely packaging.",
          ][(productIndex + userIndex) % 4],
        });
      }

      if ((productIndex + userIndex) % 2 === 0) {
        views.push({
          id: id("view", views.length),
          userId: user.id,
          productId: product.id,
          viewedAt: new Date(Date.now() - (productIndex + userIndex + 1) * 3600000),
        });
      }
    });
  });

  await prisma.like.createMany({ data: likes, skipDuplicates: true });
  await prisma.review.createMany({ data: reviews });
  await prisma.productView.createMany({ data: views });
}

async function seedCarts(buyers: Awaited<ReturnType<typeof seedUsers>>["buyers"], products: Awaited<ReturnType<typeof seedProducts>>) {
  for (let buyerIndex = 0; buyerIndex < buyers.length; buyerIndex++) {
    const cart = await prisma.cart.create({
      data: { id: id("cart", buyerIndex), userId: buyers[buyerIndex].id },
    });
    const sellerOffset = buyerIndex % SELLERS.length;
    const cartProducts = products
      .filter((product) => product.sellerId === id("seller", sellerOffset))
      .slice(0, 3);

    await prisma.cartItem.createMany({
      data: cartProducts.map((product, index) => ({
        id: id(`cart-item-${buyerIndex}`, index),
        cartId: cart.id,
        productId: product.id,
        quantity: index === 0 ? 2 : 1,
      })),
      skipDuplicates: true,
    });
  }
}

async function seedOrders(
  buyers: Awaited<ReturnType<typeof seedUsers>>["buyers"],
  products: Awaited<ReturnType<typeof seedProducts>>,
  addresses: Prisma.AddressCreateManyInput[],
) {
  const orders: Prisma.OrderCreateManyInput[] = [];
  const orderItems: Prisma.OrderItemCreateManyInput[] = [];
  const shipments: Prisma.ShipmentCreateManyInput[] = [];
  const shipmentEvents: Prisma.ShipmentEventCreateManyInput[] = [];
  const activities: Prisma.OrderActivityCreateManyInput[] = [];

  for (let index = 0; index < 10; index++) {
    const buyer = buyers[index % buyers.length];
    const sellerId = id("seller", index % SELLERS.length);
    const seller = SELLERS[index % SELLERS.length];
    const buyerAddress = addresses.find((address) => address.userId === buyer.id && address.type === AddressType.SHIPPING);
    const pickupAddress = addresses.find((address) => address.userId === sellerId && address.type === AddressType.PICKUP);
    const sellerProducts = products.filter((product) => product.sellerId === sellerId).slice(0, 2);
    if (!buyerAddress || !pickupAddress || sellerProducts.length === 0) continue;

    const selectedProducts = index % 2 === 0 ? sellerProducts.slice(0, 2) : sellerProducts.slice(0, 1);
    const subtotal = selectedProducts.reduce((sum, product) => {
      const catalogItem = PRODUCT_CATALOG[Number(product.id.split("-").at(-1)) - 1];
      return sum + productPrice(catalogItem);
    }, 0);
    const providerDeliveryFee = 1800 + (index % 4) * 350;
    const fees = calculateFees(subtotal, providerDeliveryFee);
    const orderId = id("order", index);
    const shipmentId = id("shipment", index);
    const status = [
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.PENDING,
      OrderStatus.DELIVERED,
    ][index % 5];
    const deliveryStatus =
      status === OrderStatus.DELIVERED
        ? DeliveryStatus.DELIVERED
        : status === OrderStatus.SHIPPED
          ? DeliveryStatus.IN_TRANSIT
          : status === OrderStatus.PROCESSING
            ? DeliveryStatus.READY_FOR_PICKUP
            : DeliveryStatus.QUOTED;

    orders.push({
      id: orderId,
      buyerId: buyer.id,
      status,
      isBundle: selectedProducts.length > 1,
      subtotalAmount: subtotal,
      providerDeliveryFee,
      deliveryMarkup: fees.deliveryMarkup,
      deliveryFee: fees.deliveryFee,
      serviceFee: fees.serviceFee,
      commissionAmount: fees.commissionAmount,
      sellerPayoutAmount: fees.sellerPayoutAmount,
      platformRevenueAmount: fees.platformRevenueAmount,
      totalAmount: fees.totalAmount,
      discountCode: null,
      addressId: String(buyerAddress.id),
      paymentReference: status === OrderStatus.PENDING ? null : `seed-paystack-${index + 1}`,
      createdAt: new Date(Date.now() - (index + 2) * 86400000),
    });

    selectedProducts.forEach((product, itemIndex) => {
      const catalogItem = PRODUCT_CATALOG[Number(product.id.split("-").at(-1)) - 1];
      orderItems.push({
        id: id(`order-item-${index}`, itemIndex),
        orderId,
        productId: product.id,
        quantity: 1,
        price: productPrice(catalogItem),
        sellerSettledAt: status === OrderStatus.DELIVERED ? new Date() : null,
      });
    });

    shipments.push({
      id: shipmentId,
      orderId,
      provider: DispatchProvider.MANUAL,
      serviceLevel: "STANDARD",
      status: deliveryStatus,
      externalShipmentId: `AFRA-SEED-${String(index + 1).padStart(4, "0")}`,
      externalTrackingId: `TRK-SEED-${String(index + 1).padStart(4, "0")}`,
      trackingUrl: `https://tracking.afrab.test/TRK-SEED-${String(index + 1).padStart(4, "0")}`,
      deliveryFee: fees.deliveryFee,
      currency: "NGN",
      pickupName: seller.name,
      pickupPhone: phone(index + 1),
      pickupAddress: String(pickupAddress.street),
      pickupCity: String(pickupAddress.city),
      pickupState: "Lagos",
      dropoffName: buyer.name,
      dropoffPhone: String(buyerAddress.contactPhone),
      dropoffAddress: String(buyerAddress.street),
      dropoffCity: String(buyerAddress.city),
      dropoffState: "Lagos",
      dropoffInstructions: String(buyerAddress.deliveryInstructions || "Call on arrival."),
      providerPayload: Prisma.JsonNull,
      failureReason: null,
      dispatchedAt: status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED ? new Date() : null,
      pickedUpAt: status === OrderStatus.DELIVERED ? new Date() : null,
      deliveredAt: status === OrderStatus.DELIVERED ? new Date() : null,
      cancelledAt: null,
    });

    shipmentEvents.push({
      id: id("shipment-event", index),
      shipmentId,
      status: deliveryStatus,
      providerStatus: "seed",
      message: `Seed shipment ${deliveryStatus.toLowerCase().replaceAll("_", " ")}`,
      providerPayload: Prisma.JsonNull,
    });

    activities.push(
      {
        id: id(`activity-${index}`, 0),
        orderId,
        type: OrderActivityType.CREATED,
        message: "Seed order created for marketplace testing",
        metadata: { source: "seed" },
      },
      {
        id: id(`activity-${index}`, 1),
        orderId,
        type: status === OrderStatus.PENDING ? OrderActivityType.DISPATCH_QUOTED : OrderActivityType.PAYMENT_VERIFIED,
        message: status === OrderStatus.PENDING ? "Delivery quote attached to seed order" : "Seed payment verified",
        metadata: { source: "seed" },
      },
    );
  }

  await prisma.order.createMany({ data: orders });
  await prisma.orderItem.createMany({ data: orderItems });
  await prisma.shipment.createMany({ data: shipments });
  await prisma.shipmentEvent.createMany({ data: shipmentEvents });
  await prisma.orderActivity.createMany({ data: activities });

  return orders;
}

async function seedMessagingAndNotifications(users: { id: string; name: string | null }[], products: { id: string }[]) {
  const conversations: Prisma.ConversationCreateManyInput[] = [];
  const messages: Prisma.MessageCreateManyInput[] = [];

  for (let index = 0; index < 8; index++) {
    const buyer = users[SELLERS.length + (index % BUYERS.length)];
    const seller = users[index % SELLERS.length];
    const conversationId = id("conversation", index);
    conversations.push({
      id: conversationId,
      memberOneId: buyer.id,
      memberTwoId: seller.id,
    });
    messages.push(
      {
        id: id(`message-${index}`, 0),
        conversationId,
        senderId: buyer.id,
        productId: products[index % products.length].id,
        content: "Hi, is this still available for dispatch within Lagos?",
        fileUrl: null,
        isRead: true,
      },
      {
        id: id(`message-${index}`, 1),
        conversationId,
        senderId: seller.id,
        productId: products[index % products.length].id,
        content: "Yes, it is available. I can prepare it from my Lagos pickup address.",
        fileUrl: null,
        isRead: index % 2 === 0,
      },
    );
  }

  await prisma.conversation.createMany({ data: conversations, skipDuplicates: true });
  await prisma.message.createMany({ data: messages });

  await prisma.notification.createMany({
    data: users.slice(0, 18).map((user, index) => ({
      id: id("notification", index),
      userId: user.id,
      type: [
        NotificationType.NEW_MESSAGE,
        NotificationType.ORDER_STATUS,
        NotificationType.PRODUCT_SOLD,
        NotificationType.PRICE_DROP,
      ][index % 4],
      content: [
        "You have a new marketplace message.",
        "An order status changed.",
        "One of your listed products has sold.",
        "A product you liked has a new price.",
      ][index % 4],
      isRead: index % 3 === 0,
    })),
  });
}

async function seedDiscountCodes() {
  await prisma.discountCode.createMany({
    data: [
      {
        id: "discount-lagos10",
        code: "LAGOS10",
        percentage: 10,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: new Date("2026-12-31T23:59:59.000Z"),
        maxUses: 500,
        usedCount: 27,
        isActive: true,
      },
      {
        id: "discount-firstdrop",
        code: "FIRSTDROP",
        percentage: 15,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: new Date("2026-12-31T23:59:59.000Z"),
        maxUses: 250,
        usedCount: 43,
        isActive: true,
      },
    ],
  });
}

async function main() {
  console.log("Starting AFRA B Lagos marketplace seed...");

  await cleanDatabase();
  const { sellers, buyers } = await seedUsers();
  const addresses = await seedAddresses(sellers, buyers);
  const brands = await seedBrands(sellers);
  const { categories, tags } = await seedTaxonomy();
  const products = await seedProducts(sellers, brands, categories, tags);
  await seedWallets([...sellers, ...buyers]);
  await seedSocialProof([...sellers, ...buyers], products);
  await seedCarts(buyers, products);
  const orders = await seedOrders(buyers, products, addresses);
  await seedMessagingAndNotifications([...sellers, ...buyers], products);
  await seedDiscountCodes();

  console.log("AFRA B marketplace seed completed.");
  console.table({
    sellers: sellers.length,
    buyers: buyers.length,
    products: products.length,
    orders: orders.length,
    categories: categories.length,
    tags: tags.length,
  });
  console.log("Test buyer login emails:");
  buyers.forEach((buyer) => console.log(`- ${buyer.email}`));
  console.log("Test seller login emails:");
  sellers.forEach((seller) => console.log(`- ${seller.email}`));
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
