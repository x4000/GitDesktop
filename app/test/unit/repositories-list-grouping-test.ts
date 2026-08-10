import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { groupRepositories } from '../../src/ui/repositories-list/group-repositories'
import { Repository, ILocalRepositoryState } from '../../src/models/repository'
import { CloningRepository } from '../../src/models/cloning-repository'
import { gitHubRepoFixture } from '../helpers/github-repo-builder'
import {
  getPinnedRepositoryIds,
  setRepositoryPinned,
} from '../../src/lib/fork/pinned-repositories'

/**
 * Fork behaviour. Upstream grouped by owner for github.com, by host for
 * Enterprise, plus an "Other" group and a "Recent" group past seven
 * repositories; its tests asserted exactly that. We show pinned repositories
 * first and everything else in one alphabetical list, so those assertions have
 * been replaced rather than adapted.
 */
describe('repository list grouping', () => {
  const cache = new Map<number, ILocalRepositoryState>()

  beforeEach(() => {
    for (const id of [...getPinnedRepositoryIds()]) {
      setRepositoryPinned(id, false)
    }
  })

  it('puts every repository in one group regardless of owner or host', () => {
    const repositories: Array<Repository | CloningRepository> = [
      new Repository('repo1', 1, null, false),
      new Repository(
        'repo2',
        2,
        gitHubRepoFixture({ owner: 'me', name: 'my-repo2' }),
        false
      ),
      new Repository(
        'repo3',
        3,
        gitHubRepoFixture({
          owner: 'business',
          name: 'my-repo3',
          endpoint: 'https://github.big-corp.com/api/v3',
        }),
        false
      ),
    ]

    const grouped = groupRepositories(repositories, cache, [])

    assert.equal(grouped.length, 1)
    assert.equal(grouped[0].identifier.kind, 'all')
    assert.equal(grouped[0].items.length, 3)
  })

  it('sorts alphabetically across owners and hosts', () => {
    const repositories = [
      new Repository('c', 3, null, false),
      new Repository(
        'a',
        1,
        gitHubRepoFixture({ owner: 'me', name: 'a' }),
        false
      ),
      new Repository(
        'b',
        2,
        gitHubRepoFixture({
          owner: 'business',
          name: 'b',
          endpoint: 'https://ghe.io/api/v3',
        }),
        false
      ),
    ]

    const grouped = groupRepositories(repositories, cache, [])
    const paths = grouped[0].items.map(i => i.repository.path)

    assert.deepEqual(paths, ['a', 'b', 'c'])
  })

  it('lifts pinned repositories into their own group, first', () => {
    const repositories = [
      new Repository('alpha', 1, null, false),
      new Repository('beta', 2, null, false),
      new Repository('gamma', 3, null, false),
    ]

    setRepositoryPinned(3, true)

    const grouped = groupRepositories(repositories, cache, [])

    assert.equal(grouped.length, 2)

    assert.equal(grouped[0].identifier.kind, 'pinned')
    assert.deepEqual(
      grouped[0].items.map(i => i.repository.path),
      ['gamma']
    )

    assert.equal(grouped[1].identifier.kind, 'all')
    assert.deepEqual(
      grouped[1].items.map(i => i.repository.path),
      ['alpha', 'beta']
    )
  })

  it('sorts the pinned group alphabetically too', () => {
    const repositories = [
      new Repository('zulu', 1, null, false),
      new Repository('alpha', 2, null, false),
    ]

    setRepositoryPinned(1, true)
    setRepositoryPinned(2, true)

    const grouped = groupRepositories(repositories, cache, [])

    assert.equal(grouped.length, 1)
    assert.equal(grouped[0].identifier.kind, 'pinned')
    assert.deepEqual(
      grouped[0].items.map(i => i.repository.path),
      ['alpha', 'zulu']
    )
  })

  it('disambiguates duplicate names anywhere in the list', () => {
    // Upstream did not disambiguate these: two repositories called "repo" were
    // told apart by sitting under different owners. In one flat list nothing
    // distinguishes them, so both need it.
    const repositories = [
      new Repository(
        'repo-a',
        1,
        gitHubRepoFixture({ owner: 'user1', name: 'repo' }),
        false
      ),
      new Repository(
        'repo-b',
        2,
        gitHubRepoFixture({ owner: 'user2', name: 'repo' }),
        false
      ),
      new Repository(
        'unique',
        3,
        gitHubRepoFixture({ owner: 'user1', name: 'unique' }),
        false
      ),
    ]

    const grouped = groupRepositories(repositories, cache, [])
    const items = grouped[0].items

    const duplicates = items.filter(i => i.text[0] === 'repo')
    assert.equal(duplicates.length, 2)
    assert(duplicates.every(i => i.needsDisambiguation))

    const unique = items.find(i => i.text[0] === 'unique')
    assert(unique !== undefined)
    assert(!unique.needsDisambiguation)
  })

  it('disambiguates a pinned repository against its twin in the main group', () => {
    const repositories = [
      new Repository(
        'repo-a',
        1,
        gitHubRepoFixture({ owner: 'user1', name: 'repo' }),
        false
      ),
      new Repository(
        'repo-b',
        2,
        gitHubRepoFixture({ owner: 'user2', name: 'repo' }),
        false
      ),
    ]

    setRepositoryPinned(1, true)

    const grouped = groupRepositories(repositories, cache, [])

    assert.equal(grouped.length, 2)
    assert(grouped[0].items[0].needsDisambiguation)
    assert(grouped[1].items[0].needsDisambiguation)
  })
})
