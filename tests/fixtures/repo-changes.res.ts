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
    }
  ],
  file: {
    _id: '64daee2d0c4dbe0dd50332d1',
    file: 'README.md',
    repo: '64daee2568bf0d1a930faea7',
    updatedAt: '2023 -08 - 15T03: 17:00.934Z',
    changes: {
      '64daee2568bf0d1a930faea5': {
        sha: 'e154e445d3f10e9ee95436f43a6d1bd2f3783220',
        lines: [[12, 0, 1]],
        s3key: '64daee2568bf0d1a930faea5/github.com:home/user/dir/README.md'
      },
      '64daee2568bf0d1a930faea6': {
        sha: 'e154e445d3f10e9ee95436f43a6d1bd2f3783220',
        lines: [[1, -1, 0], [3, -1, 3], [6, 0, 1]],
        s3key: '64daee2568bf0d1a930faea6/github.com:home/user/dir/README.md'
      }
    }
  },
  tree: [
    {
      _id: '64daee2d0c4dbe0dd50332d1',
      file: 'README.md',
      repo: '64daee2568bf0d1a930faea7',
      updatedAt: '2023 -08 - 15T03: 17:00.934Z',
      changes: {
        '64daee2568bf0d1a930faea5': {
          sha: 'e154e445d3f10e9ee95436f43a6d1bd2f3783220',
          lines: [[12, 0, 1]],
          s3key: '64daee2568bf0d1a930faea5/github.com:home/user/dir/README.md'
        },
        '64daee2568bf0d1a930faea6': {
          sha: 'e154e445d3f10e9ee95436f43a6d1bd2f3783220',
          lines: [[1, -1, 0], [3, -1, 3], [6, 0, 1]],
          s3key: '64daee2568bf0d1a930faea6/github.com:home/user/dir/README.md'
        }
      }
    },
    {
      _id: '64daee2d0c4dbe0dd50332d4',
      file: 'src/stores/app.store.js',
      repo: '64daee2568bf0d1a930faea7',
      updatedAt: '2023 -08 - 15T03: 17:01.201Z',
      changes: {
        '64daee2568bf0d1a930faea5': {
          sha: 'e154e445d3f10e9ee95436f43a6d1bd2f3783220',
          lines: [[4, -1, 1], [7, -2, 6], [14, -1, 2]],
          s3key: '64daee2568bf0d1a930faea5/github.com:home/user/dir/src/stores/app.store.js'
        }
      }
    },
  ],
  agg: { e154e445d3f10e9ee95436f43a6d1bd2f3783220: [3, 4, 9, 10, 19] }
}

export default REPO_CHANGES
