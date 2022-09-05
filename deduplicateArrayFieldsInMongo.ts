import { type Document, MongoClient } from "https://deno.land/x/mongo/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
const envs = config();

console.time("took");
const mongo = new MongoClient();
try {
  await mongo.connect(envs.MONGODB_URL as string);
  const collection = mongo.database("entities").collection("contacts");
  console.log("Connected to mongo...");

  const fieldsToProcess = ["phones", "emails", "_linkedEntityIds", "linked_estate", "addresses"]
  for (const fieldName of fieldsToProcess) {
    console.log(`deduplicating field: ${fieldName}...`)
    const results = await collection.find({ [`content.${fieldName}.50`]: { $exists: true } }).toArray();
    for (const result of results) {
      const dataField = result.content?.[fieldName]
      const uniqueEntries = buildUniuqueEntries(dataField);
  
      console.log(`updating id ${result._id} (${dataField?.length} entries) ...`);
      console.log(`setting ${fieldName} to ${JSON.stringify(uniqueEntries,null, 2)}`)
      await collection.updateOne(
        { _id: result._id },
        {
          $set: {
            [`content.${fieldName}`]: uniqueEntries,
            // "atlasSearch.concatenatedFields.addresses.city": uniqueAddresses.map((
            //   a,
            // ) => a?.city).join(" "),
            // "atlasSearch.concatenatedFields.addresses.street": uniqueAddresses
            //   .map((a) => a?.street).join(" "),

          },
        },
      );
    }
    
  }

} catch (error) {
  console.error(error);
} finally {
  await mongo.close();
  console.timeEnd("took");
}

function buildUniuqueEntries(fieldDoc: Document ) {
  const withDuplicates = fieldDoc?.map((e) => JSON.stringify(e));
  return Array.from(new Set(withDuplicates)).map((e) => JSON.parse(e as string));
}
