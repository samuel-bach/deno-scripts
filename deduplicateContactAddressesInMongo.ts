// Sometimes we get duplicates in content.adresses. This scripts fixes those occurences

import { type Document, MongoClient } from "https://deno.land/x/mongo/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
const envs = config();

console.time("everything");
const mongo = new MongoClient();
try {
  await mongo.connect(envs.MONGODB_URL as string);
  const db = mongo.database("entities");
  const collection = db.collection("contacts");
  console.log("Connected to mongo...");

  const condition = { "content.addresses.50": { $exists: true } };
  const results = await collection
    .find(condition)
    .toArray();

  for (const result of results) {
    const uniqueAddresses = buildUniqueAddresses(result);

    console.log(`updating id ${result._id}...`);
    await collection.updateOne(
      { _id: result._id },
      {
        $set: {
          ["content.addresses"]: buildUniqueAddresses(result),
          "atlasSearch.concatenatedFields.addresses.city": uniqueAddresses.map((
            a,
          ) => a?.city).join(" "),
          "atlasSearch.concatenatedFields.addresses.street": uniqueAddresses
            .map((a) => a?.street).join(" "),
        },
      },
    );
  }
} catch (error) {
  console.error(error);
} finally {
  await mongo.close();
  console.timeEnd("everything");
}

function buildUniqueAddresses(doc: Document) {
  const withDuplicates = doc.content?.addresses?.map((e) => JSON.stringify(e));
  return Array.from(new Set(withDuplicates)).map((e) =>
    JSON.parse(e as string)
  );
}
