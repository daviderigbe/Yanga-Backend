import { db } from "./src/lib/db";
import { ProductStatus, Condition, Gender, AddressType } from "@prisma/client";

async function main() {
  console.log("Starting database seeding...");

  // Clean up existing data (optional - remove if you want to keep existing data)
  await cleanDatabase();

  // Create categories
  const categories = await createCategories();

  // Create tags
  const tags = await createTags();

  // Create users
  const users = await createUsers();

  // Create products
  await createProducts(users, categories, tags);

  console.log("Database seeding completed successfully!");
}

async function cleanDatabase() {
  console.log("Cleaning existing data...");

  // Delete in order to respect foreign key constraints
  await db.orderItem.deleteMany({});
  await db.order.deleteMany({});
  await db.tagsOnProducts.deleteMany({});
  await db.productImage.deleteMany({});
  await db.review.deleteMany({});
  await db.like.deleteMany({});
  await db.product.deleteMany({});
  await db.tag.deleteMany({});
  await db.category.deleteMany({});
  await db.notification.deleteMany({});
  await db.message.deleteMany({});
  await db.follow.deleteMany({});
  await db.savedCard.deleteMany({});
  await db.address.deleteMany({});
  await db.session.deleteMany({});
  await db.user.deleteMany({});

  console.log("Database cleaned.");
}

async function createCategories() {
  console.log("Creating categories...");

  const categoryNames = [
    "Tops",
    "Bottoms",
    "Dresses",
    "Outerwear",
    "Shoes",
    "Accessories",
    "Activewear",
    "Formal Wear",
  ];

  const categories = [];

  for (const name of categoryNames) {
    const category = await db.category.create({
      data: { name },
    });
    categories.push(category);
  }

  console.log(`Created ${categories.length} categories.`);
  return categories;
}

async function createTags() {
  console.log("Creating tags...");

  const tagNames = [
    "Casual",
    "Formal",
    "Vintage",
    "Modern",
    "Summer",
    "Winter",
    "Spring",
    "Fall",
    "Beach",
    "Office",
    "Party",
    "Everyday",
    "Luxury",
    "Budget",
    "Streetwear",
    "Classic",
  ];

  const tags = [];

  for (const name of tagNames) {
    const tag = await db.tag.create({
      data: { name },
    });
    tags.push(tag);
  }

  console.log(`Created ${tags.length} tags.`);
  return tags;
}

async function createUsers() {
  console.log("Creating users...");

  // Hash password beforehand - password is 'Password123'
  const passwordHash = await Bun.password.hash("Password123");

  const usersData = [
    {
      email: "john.doe@example.com",
      name: "John Doe",
      userName: "johndoe",
      password: passwordHash,
      bio: "Fashion enthusiast with a love for vintage items.",
      imageUrl: "https://randomuser.me/api/portraits/men/1.jpg",
    },
    {
      email: "jane.smith@example.com",
      name: "Jane Smith",
      userName: "janesmith",
      password: passwordHash,
      bio: "Passionate about sustainable fashion and minimalist lifestyle.",
      imageUrl: "https://randomuser.me/api/portraits/women/2.jpg",
    },
    {
      email: "alex.johnson@example.com",
      name: "Alex Johnson",
      userName: "alexj",
      password: passwordHash,
      bio: "Sneakerhead and streetwear collector since 2010.",
      imageUrl: "https://randomuser.me/api/portraits/men/3.jpg",
    },
  ];

  const users = [];

  for (const userData of usersData) {
    const user = await db.user.create({
      data: {
        ...userData,
        addresses: {
          create: {
            type: AddressType.SHIPPING,
            street: "123 Main St",
            city: "New York",
            state: "NY",
            country: "USA",
            zipCode: "10001",
            isDefault: true,
          },
        },
      },
    });
    users.push(user);
  }

  // Create follow relationships
  await db.follow.create({
    data: {
      followerId: users[0].id,
      followingId: users[1].id,
    },
  });

  await db.follow.create({
    data: {
      followerId: users[0].id,
      followingId: users[2].id,
    },
  });

  await db.follow.create({
    data: {
      followerId: users[1].id,
      followingId: users[0].id,
    },
  });

  console.log(
    `Created ${users.length} users with addresses and follow relationships.`,
  );
  return users;
}

async function createProducts(users, categories, tags) {
  console.log("Creating products...");

  const productTemplates = [
    // Fashion items
    {
      title: "Vintage Leather Jacket",
      description:
        "Genuine leather jacket from the 90s. Great condition with minor wear.",
      basePrice: 89.99,
      discountPercent: 0,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIGHTLY_USED,
      size: "M",
      gender: Gender.UNISEX,
      color: "Brown",
      brand: "Vintage Collection",
      categoryIndex: 3, // Outerwear
      tagIndices: [2, 3], // Vintage, Modern
      images: [
        "https://images.unsplash.com/photo-1551028719-00167b16eac5",
        "https://images.unsplash.com/photo-1551028719-a1550e77a40e",
      ],
    },
    {
      title: "Premium Running Shoes",
      description:
        "High performance running shoes with cushioned sole. Used for only 3 months.",
      basePrice: 65.0,
      discountPercent: 10,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIKE_NEW,
      size: "42",
      gender: Gender.MEN,
      color: "Black/Red",
      brand: "Nike",
      categoryIndex: 4, // Shoes
      tagIndices: [6, 13], // Spring, Luxury
      images: [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
        "https://images.unsplash.com/photo-1607522370275-f14206abe5d3",
      ],
    },
    {
      title: "Summer Floral Dress",
      description:
        "Light and breezy floral dress, perfect for summer. Worn only once.",
      basePrice: 45.5,
      discountPercent: 15,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIKE_NEW,
      size: "S",
      gender: Gender.WOMEN,
      color: "Multicolor",
      brand: "Zara",
      categoryIndex: 2, // Dresses
      tagIndices: [4, 8], // Summer, Beach
      images: [
        "https://images.unsplash.com/photo-1612336307429-8a898d10e223",
        "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03",
      ],
    },
    {
      title: "Designer Sunglasses",
      description:
        "Authentic designer sunglasses with UV protection. Minor scratches on the frame.",
      basePrice: 120.0,
      discountPercent: 25,
      status: ProductStatus.ACTIVE,
      condition: Condition.FAIRLY_USED,
      size: "One Size",
      gender: Gender.UNISEX,
      color: "Black",
      brand: "Ray-Ban",
      categoryIndex: 5, // Accessories
      tagIndices: [12, 15], // Luxury, Classic
      images: [
        "https://images.unsplash.com/photo-1511499767150-a48a237f0083",
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f",
      ],
    },
    {
      title: "Slim Fit Jeans",
      description:
        "Classic blue slim fit jeans. Very comfortable and in good condition.",
      basePrice: 35.99,
      discountPercent: 0,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIGHTLY_USED,
      size: "32",
      gender: Gender.MEN,
      color: "Blue",
      brand: "Levi's",
      categoryIndex: 1, // Bottoms
      tagIndices: [0, 11], // Casual, Everyday
      images: [
        "https://images.unsplash.com/photo-1542272604-787c3835535d",
        "https://images.unsplash.com/photo-1541099649105-f69ad21f3246",
      ],
    },
    {
      title: "Formal Blazer",
      description:
        "Navy blue formal blazer, worn to only a few occasions. Perfect for interviews.",
      basePrice: 75.0,
      discountPercent: 5,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIKE_NEW,
      size: "L",
      gender: Gender.MEN,
      color: "Navy Blue",
      brand: "Hugo Boss",
      categoryIndex: 7, // Formal Wear
      tagIndices: [1, 9], // Formal, Office
      images: [
        "https://images.unsplash.com/photo-1622519407650-3df9883f76a5",
        "https://images.unsplash.com/photo-1598808503746-f34c53b9323e",
      ],
    },
    {
      title: "Minimalist White Sneakers",
      description:
        "Clean, simple white sneakers perfect for everyday wear. Barely used.",
      basePrice: 79.99,
      discountPercent: 10,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIKE_NEW,
      size: "43",
      gender: Gender.UNISEX,
      color: "White",
      brand: "Adidas",
      categoryIndex: 4, // Shoes
      tagIndices: [3, 11], // Modern, Everyday
      images: [
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a",
        "https://images.unsplash.com/photo-1460353581133-d2d7eae3f94c",
      ],
    },
    {
      title: "Organic Cotton Yoga Pants",
      description:
        "Comfortable high-waisted yoga pants made from sustainable organic cotton.",
      basePrice: 55.0,
      discountPercent: 15,
      status: ProductStatus.ACTIVE,
      condition: Condition.NEW,
      size: "M",
      gender: Gender.WOMEN,
      color: "Black",
      brand: "Lululemon",
      categoryIndex: 6, // Activewear
      tagIndices: [6, 13], // Spring, Budget
      images: [
        "https://images.unsplash.com/photo-1599058917765-a780eda07a3e",
        "https://images.unsplash.com/photo-1598193957011-8ae5ded7aaec",
      ],
    },
    {
      title: "Vintage Silk Scarf",
      description:
        "Elegant silk scarf with intricate geometric pattern. Perfect accessory.",
      basePrice: 45.5,
      discountPercent: 20,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIGHTLY_USED,
      size: "One Size",
      gender: Gender.WOMEN,
      color: "Blue/Gold",
      brand: "Hermès",
      categoryIndex: 5, // Accessories
      tagIndices: [2, 12], // Vintage, Luxury
      images: [
        "https://images.unsplash.com/photo-1617104666298-550a8cdf9a39",
        "https://images.unsplash.com/photo-1589285086712-4babb42d08cd",
      ],
    },
    {
      title: "Vintage Denim Jacket",
      description:
        "Classic blue denim jacket with authentic 80s wash. Unique vintage piece.",
      basePrice: 65.0,
      discountPercent: 5,
      status: ProductStatus.ACTIVE,
      condition: Condition.FAIRLY_USED,
      size: "L",
      gender: Gender.UNISEX,
      color: "Blue",
      brand: "Levi's",
      categoryIndex: 3, // Outerwear
      tagIndices: [2, 14], // Vintage, Streetwear
      images: [
        "https://images.unsplash.com/photo-1509939197915-0dda9c299a9d",
        "https://images.unsplash.com/photo-1509350022279-43e4b55e506c",
      ],
    },
    {
      title: "Summer Linen Button-Down Shirt",
      description:
        "Lightweight breathable linen shirt. Perfect for summer office or casual wear.",
      basePrice: 49.99,
      discountPercent: 0,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIKE_NEW,
      size: "M",
      gender: Gender.MEN,
      color: "Light Blue",
      brand: "Uniqlo",
      categoryIndex: 0, // Tops
      tagIndices: [4, 9], // Summer, Office
      images: [
        "https://images.unsplash.com/photo-1610302844055-f00f1248bca8",
        "https://images.unsplash.com/photo-1613194537211-10d33fc6d914",
      ],
    },
    {
      title: "Winter Wool Coat",
      description:
        "High-quality wool coat in classic camel color. Warm and stylish for winter.",
      basePrice: 129.99,
      discountPercent: 15,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIKE_NEW,
      size: "L",
      gender: Gender.WOMEN,
      color: "Camel",
      brand: "Zara",
      categoryIndex: 3, // Outerwear
      tagIndices: [5, 7], // Winter, Fall
      images: [
        "https://images.unsplash.com/photo-1540221652346-c7d0221d9c04",
        "https://images.unsplash.com/photo-1614900126822-5d7276a31fe0",
      ],
    },
    {
      title: "Classic Chinos",
      description:
        "Versatile slim-fit chinos in neutral khaki. Great for multiple occasions.",
      basePrice: 59.5,
      discountPercent: 10,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIGHTLY_USED,
      size: "34",
      gender: Gender.MEN,
      color: "Khaki",
      brand: "Dockers",
      categoryIndex: 1, // Bottoms
      tagIndices: [0, 10], // Casual, Everyday
      images: [
        "https://images.unsplash.com/photo-1600269452121-ea0a9be9a7d2",
        "https://images.unsplash.com/photo-1611199531705-aa0314ecb9d3",
      ],
    },
    {
      title: "Evening Cocktail Dress",
      description:
        "Elegant black cocktail dress with subtle sequin details. Perfect for parties.",
      basePrice: 89.0,
      discountPercent: 25,
      status: ProductStatus.ACTIVE,
      condition: Condition.LIKE_NEW,
      size: "M",
      gender: Gender.WOMEN,
      color: "Black",
      brand: "Ted Baker",
      categoryIndex: 2, // Dresses
      tagIndices: [1, 10], // Formal, Party
      images: [
        "https://images.unsplash.com/photo-1519345182560-3f2917c472ef",
        "https://images.unsplash.com/photo-1525507119028-ed4c629c60f3",
      ],
    },
    {
      title: "Retro Sports Track Jacket",
      description:
        "Classic track jacket with vintage sports brand logo. Trendy streetwear piece.",
      basePrice: 45.0,
      discountPercent: 5,
      status: ProductStatus.ACTIVE,
      condition: Condition.FAIRLY_USED,
      size: "S",
      gender: Gender.UNISEX,
      color: "Red/White",
      brand: "Adidas Originals",
      categoryIndex: 3, // Outerwear
      tagIndices: [3, 14], // Modern, Streetwear
      images: [
        "https://images.unsplash.com/photo-1489987707489-bdcb91a5af48",
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77f80f",
      ],
    },
  ];

  const products = [];

  for (let i = 0; i < productTemplates.length; i++) {
    const template = productTemplates[i];
    const sellerId = users[i % users.length].id;

    const product = await db.product.create({
      data: {
        sellerId,
        title: template.title,
        description: template.description,
        basePrice: template.basePrice,
        discountPercent: template.discountPercent,
        status: template.status,
        condition: template.condition,
        size: template.size,
        gender: template.gender,
        color: template.color,
        brand: template.brand,
        categoryId: categories[template.categoryIndex].id,
        images: {
          create: template.images.map((url, index) => ({
            url,
            order: index,
          })),
        },
      },
    });

    // Add tags to product
    for (const tagIndex of template.tagIndices) {
      await db.tagsOnProducts.create({
        data: {
          productId: product.id,
          tagId: tags[tagIndex].id,
        },
      });
    }

    // Add some likes
    for (let j = 0; j < users.length; j++) {
      if (j !== i % users.length) {
        // Don't let users like their own products
        try {
          await db.like.create({
            data: {
              userId: users[j].id,
              productId: product.id,
            },
          });
        } catch (error) {
          // Skip if unique constraint is violated
          console.log(`Like already exists for user ${j} and product ${i}`);
        }
      }
    }

    // Add reviews
    if (i % 2 === 0) {
      // Only add reviews to some products
      for (let j = 0; j < users.length; j++) {
        if (j !== i % users.length) {
          // Don't let users review their own products
          await db.review.create({
            data: {
              userId: users[j].id,
              productId: product.id,
              rating: 4 + (j % 2), // Ratings 4-5
              description: "Great product, exactly as described!",
            },
          });
        }
      }
    }

    products.push(product);
  }

  console.log(
    `Created ${products.length} products with images, tags, likes, and reviews.`,
  );
  return products;
}

// Run the main function
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Close the database connection
    await db.$disconnect();
  });
