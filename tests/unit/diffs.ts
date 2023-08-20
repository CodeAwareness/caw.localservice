import CAWDiffs from '@/services/diffs'
import { A, B1, B2, C } from '../fixtures/unit-diff'

describe('Diff methods', () => {
  test('should return the correct highlights for peer and local', async () => {
    const peer = [3, 8, 17, 25]
    const local = [[8, -3, 2], [13, 0, 2], [18, -1, 1]]

    const res = await CAWDiffs.zipAgg(peer, local)

    expect(res).toEqual([3, 7, 18, 26])
  })

  test('should return the correct highlights for peer and local with cumulative carry', async () => {
    const peer = [3, 8, 17, 25]
    const local = [[17, -3, 2], [19, 0, 2], [22, -4, 1]]

    const res = await CAWDiffs.zipAgg(peer, local)

    expect(res).toEqual([3, 8, 16, 23])
  })

  test('should return the correct highlights for local changes only', async () => {
    const peer = []
    const local = [[8, -3, 2], [13, 0, 2], [18, -1, 1]]

    const res = await CAWDiffs.zipAgg(peer, local)

    expect(res).toEqual([])
  })

  test('should return the correct highlights for peer changes only', async () => {
    const peer = [3, 8, 17, 25]
    const local = []

    const res = await CAWDiffs.zipAgg(peer, local)

    expect(res).toEqual([3, 8, 17, 25])
  })
})