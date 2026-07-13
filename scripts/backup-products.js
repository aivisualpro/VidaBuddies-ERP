const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI found in .env");
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const sourceCollection = 'vidaproducts';
    const backupCollection = 'vidaproductsBackup';
    
    // Check if source collection exists
    const collections = await db.listCollections({ name: sourceCollection }).toArray();
    if (collections.length === 0) {
      console.error(`Source collection "${sourceCollection}" does not exist.`);
      process.exit(1);
    }
    
    console.log(`Copying documents from "${sourceCollection}" to "${backupCollection}"...`);
    
    // Get all products
    const products = await db.collection(sourceCollection).find({}).toArray();
    console.log(`Found ${products.length} products to copy.`);
    
    if (products.length > 0) {
      // Clear existing backup collection if any
      await db.collection(backupCollection).deleteMany({});
      
      // Insert to backup collection
      const result = await db.collection(backupCollection).insertMany(products);
      console.log(`Successfully backed up ${result.insertedCount} products to "${backupCollection}".`);
    } else {
      console.log("No products to backup.");
    }
  } catch (error) {
    console.error("Backup failed:", error);
  } finally {
    await client.close();
  }
}

run().catch(console.error);
