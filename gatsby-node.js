const report = require("gatsby-cli/lib/reporter");
const firebase = require("firebase");

const applyConditions = (collection, conditions = []) => {
  if (!conditions.length) {
    return collection;
  }
  return conditions.reduce(
    (coll, condition) => coll.where.apply(coll, condition),
    collection
  );
};

exports.sourceNodes = async (
  { actions, createContentDigest },
  { config, types }
) => {
  try {
    firebase.initializeApp(config);
  } catch (e) {
    report.warn(
      "Could not initialize Firebase. Please supply a valid configuration object in gatsby-config.js."
    );
    report.warn(e);
    return;
  }

  const { createNode } = actions;

  const db = firebase.firestore();

  const promises = types.map(
    async ({
      collection,
      collectionGroup,
      type,
      map = node => node,
      conditions
    }) => {
      let collectionOrGroup;
      if (collection) {
        collectionOrGroup = db.collection(collection);
      } else if (collectionGroup) {
        collectionOrGroup = db.collectionGroup(collectionGroup);
      } else {
        report.warn(
          "Ignoring type '${type}': type is missing 'collection' or 'collectionGroup' setting!"
        );
        return;
      }
      const conditionedCollection = applyConditions(
        collectionOrGroup,
        conditions
      );

      try {
        const snapshot = await conditionedCollection.get();

        for (let doc of snapshot.docs) {
          const nodeData = map(doc.data());
          const nodeMeta = {
            id: doc.ref.path,
            parent: null,
            children: [],
            internal: {
              type,
              contentDigest: createContentDigest(nodeData)
            }
          };
          createNode(Object.assign({}, nodeData, nodeMeta));
          Promise.resolve();
        }
      } catch (error) {
        report.warn(`Failed fetching snapshots from firestore: ${error}`);
        return;
      }
    }
  );

  await Promise.all(promises);

  return;
};
