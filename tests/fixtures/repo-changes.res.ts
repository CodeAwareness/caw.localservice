const REPO_CHANGES = {
  users: [
    {
      _id: '64daee2568bf0d1a930faea5',
      name: 'user One',
      alias: 'Neo',
      email: 'neo@gmail.com',
      avatar: 'https://loremflickr.com/640/480?lock=8267390775197696',
      lang: 'neo',
      createdAt: '2023 -08 - 15T03: 17:00.804Z',
    },
    {
      _id: '64daee2568bf0d1a930faea6',
      name: 'User one',
      alias: 'Trinity',
      email: 'trinity@gmail.com',
      avatar: 'https://picsum.photos/seed/q9LP1Tf/640/480',
      lang: 'tri',
      createdAt: '2023 -08 - 15T03: 17:00.804Z',
    },
    {
      _id: '64daee2568bf0d1a930faea7',
      name: 'User Three',
      alias: 'Morpheus',
      email: 'morpheus@gmail.com',
      avatar: 'https://picsum.photos/seed/q9LP1Tf/640/480',
      lang: 'phe',
      createdAt: '2023 -08 - 15T03: 17:00.804Z',
    }
  ],
  file: {
    _id: '64daee2d0c4dbe0dd50332d1',
    file: 'package.json',
    repo: '64daee2568bf0d1a930faea7',
    updatedAt: '2023 -08 - 15T03: 17:00.934Z',
    changes: {
      '64daee2568bf0d1a930faea5': {
        sha: 'ec989dc1fea23ef69ec37ba3a556d04f117cf835',
        lines: [[3, 0, 1]],
        s3key: '64daee2568bf0d1a930faea5/github.com:home/user1/dir/package.json'
      },
      '64daee2568bf0d1a930faea6': {
        sha: 'ec989dc1fea23ef69ec37ba3a556d04f117cf835',
        lines: [[1, -1, 1], [3, -1, 3], [7, -1, 1]],
        s3key: '64daee2568bf0d1a930faea6/github.com:home/user2/dir/package.json'
      },
      '64daee2568bf0d1a930faea7': {
        sha: '414e625fd283ac36e86ac8c972e698496b8e2c6d',
        lines: [[2, -1, 1], [4, -2, 3]],
        s3key: '64daee2568bf0d1a930faea6/github.com:home/user3/dir/package.json'
      }
    }
  },
  tree: [
    'package.json',
    'src/stores/app.store.js',
  ],
  agg: {
    'ec989dc1fea23ef69ec37ba3a556d04f117cf835': [1, 3, 7],
    '414e625fd283ac36e86ac8c972e698496b8e2c6d': [2, 4, 5],
  }
}

export default REPO_CHANGES
