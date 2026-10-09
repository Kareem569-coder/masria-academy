import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const [firestoreAddress, firestorePort] = firestoreHost?.split(':') ?? [];
const emulatorDescribe = firestoreHost ? describe : describe.skip;
let testEnvironment: RulesTestEnvironment;

emulatorDescribe('ImgBB package cover Firestore persistence', () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId: process.env.GCLOUD_PROJECT || 'demo-masria-cover-flow',
      firestore: {
        host: firestoreAddress,
        port: Number(firestorePort),
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  beforeEach(async () => testEnvironment.clearFirestore());
  afterAll(async () => testEnvironment.cleanup());

  it('stores the hosted ImgBB URL on the created package document', async () => {
    const teacher = testEnvironment.authenticatedContext('teacher-uid', {
      email: 'aymankareem548@gmail.com',
    });
    const coverImageUrl = 'https://i.ibb.co/example/package-cover.png';

    const packageReference = await assertSucceeds(addDoc(collection(teacher.firestore(), 'coursePackages'), {
      name: 'Package with cover',
      gradeLevel: 'Sec 1',
      isActive: true,
      createdBy: 'teacher-uid',
      lessonIds: [],
      coverImageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    const createdPackage = await assertSucceeds(getDoc(doc(teacher.firestore(), 'coursePackages', packageReference.id)));

    expect(createdPackage.data()?.coverImageUrl).toBe(coverImageUrl);
  });
});
