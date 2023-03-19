/* eslint-disable indent */
export const GIT_MOCKS = {}

GIT_MOCKS.FETCH = ''

GIT_MOCKS.DIFF_ARCHIVE = ''
GIT_MOCKS.DIFF_ARCHIVE2 = ''

GIT_MOCKS.DIFF_README = `diff --git a/README.md b/README.md
index 09a1bd5..46b743f 100644
--- a/README.md
+++ b/README.md
@@ -2 +0,0 @@
-# CodeAwareness Homepage
@@ -4 +2,3 @@
-## Project setup
+# Project Home
+
+## SETUP
@@ -8,0 +8 @@ npm install
+(or use yarn)`

GIT_MOCKS.DIFF_README2 = `diff --git a/README.md b/README.md
index 09a1bd5..46b743f 100644
--- a/README.md
+++ b/README.md
@@ -15 +13 @@ npm run serve
-### Compiles and minifies for production
+### Compiles and minifies for production (Uno)
@@ -30,0 +35,3 @@ See [Configuration Reference](https://cli.vuejs.org/config/).
+
+### TODO
+Add husky.
`

GIT_MOCKS.DIFF_U = ''

GIT_MOCKS.DIFF_UNTRACKED = [

    `diff --git a/../empty.txt b/src/assets/code-awareness-screenshot-01.jpg
index e69de29..f9414a7 100644
Binary files a/../empty.txt and b/src/assets/code-awareness-screenshot-01.jpg differ`,

    `diff --git a/../empty.txt b/src/views/BetaTesting.vue
index e69de29..01ac20a 100644
--- a/../empty.txt
+++ b/src/views/BetaTesting.vue
@@ -0,0 +1,16 @@
+<template>
+  <section>
+    <div>
+      <h2>Code Awareness: Becoming a Beta tester</h2>
+      <button><router-link to="/">Home</router-link></button>
+      <!-- TODO -->
+      <p>Once you've submitted your request, we'll have the various teams review our systems for your personal data and send you final confirmation after this process is complete.</p>
+    </div>
+  </section>
+</template>
+
+<script>
+export default {
+  name: 'BetaTesting',
+}
+</script>`,

]

GIT_MOCKS.LOG_N = `49b513a32d0b86e43efa31d4b0d5f996972cd704
b63989ddb562c33d977462b2e0c252963a42fedd
3cd63c1333acf292f47a008617bbda909dddb4ec
0c57c5039813728355fa2c53fe1320b93a6f4163
5dd0789d743b64a986463ed4e945b650e3c2a467
89b4b96aa6007c479eb3595ad268ea699ced5121`

GIT_MOCKS.LOG_PRETTY = '2021-03-20T23:25:25+09:00 49b513a32d0b86e43efa31d4b0d5f996972cd704'

GIT_MOCKS.LOG_SINCE = `2021-03-23T01:04:35+09:00 4d9c3dc8ddda6cd5bc59813fd605be56d643373e
2021-03-20T23:25:25+09:00 49b513a32d0b86e43efa31d4b0d5f996972cd704
2021-03-20T02:32:43+09:00 b63989ddb562c33d977462b2e0c252963a42fedd
2021-03-18T14:31:02+09:00 3cd63c1333acf292f47a008617bbda909dddb4ec`

GIT_MOCKS.LS_FILES = `src/assets/code-awareness-screenshot-01.jpg
src/views/BetaTesting.vue`

GIT_MOCKS.BRANCH = `dev 0cafe1b dev comments
* light     49b513a working tests again
  main      89b4b96 [ahead 1] CodeAwareness name change`

  /* eslint-disable-next-line no-tabs */
GIT_MOCKS.FOR_EACH_REF = '49b513a32d0b86e43efa31d4b0d5f996972cd704 commit	refs/remotes/origin/light'

GIT_MOCKS.REV_LIST = 'TEST_HEAD'
