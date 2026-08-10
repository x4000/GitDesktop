import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  endpointSatisfies,
  VersionConstraint,
} from '../../src/lib/endpoint-capabilities'
import { SemVer, parse } from 'semver'
import { getDotComAPIEndpoint } from '../../src/lib/api'
import { forceUnwrap } from '../../src/lib/fatal-error'

describe('endpoint-capabilities', () => {
  describe('endpointSatisfies', () => {
    it('recognizes github.com', () => {
      assert.equal(testDotCom(true), true)
      assert.equal(testDotCom(false), false)
    })

    it('recognizes GHES', () => {
      assert.equal(testGHES(false), false)
      assert.equal(testGHES(true), true)
    })

    it('recognizes GHAE', () => {
      assert.equal(testGHEDotCom(false), false)
      assert.equal(testGHEDotCom(true), true)
    })

    // If we can't determine the actual version of a GitHub Enterprise Server
    // instance we'll assume it's running the oldest still supported version
    // of GHES. This is defined in the `assumedGHESVersion` constant in
    // endpoint-capabilities.ts and needs to be updated periodically.
    it('assumes GHES versions', () => {
      assert.equal(testGHES('>= 3.1.1'), false)
      assert.equal(testGHES('>= 3.1.0'), true)
    })

    it('parses semver ranges', () => {
      assert.equal(testGHES('>= 1', '1.0.0'), true)
      assert.equal(testGHES('> 1.0.0', '1.0.0'), false)
      assert.equal(testGHES('> 0.9.9', '1.0.0'), true)
    })

    it('deals with common cases (smoketest)', () => {
      assert.equal(
        testEndpoint('https://api.github.com', {
          dotcom: true,
          ghe: false,
          es: '>= 3.0.0',
        }),
        true
      )

      assert.equal(
        testEndpoint(
          'https://ghe.io',
          {
            dotcom: false,
            ghe: false,
            es: '>= 3.1.0',
          },
          '3.1.0'
        ),
        true
      )
    })
  })

  // Fork addition. GHES is defined by exclusion, so without an explicit Gitea
  // check a Gitea instance is treated as GHES running the assumed version and
  // silently inherits capabilities it does not have.
  describe('gitea', () => {
    it('recognizes a known Gitea instance', () => {
      assert.equal(testGitea(true), true)
      assert.equal(testGitea(false), false)
    })

    it('does not treat Gitea as GHES', () => {
      // The exact constraint that would otherwise match via assumedGHESVersion.
      assert.equal(
        testEndpoint(GiteaEndpoint, { es: '>= 3.1.0' }),
        false,
        'Gitea satisfied a GitHub Enterprise Server constraint'
      )
    })

    it('defaults every GitHub-only capability to unsupported', () => {
      // The whole point of `gitea` defaulting to false: predicates that never
      // mention Gitea must answer no, so upstream capability checks degrade
      // safely without each one having to be revisited.
      for (const constraint of [
        { dotcom: true },
        { dotcom: true, es: '>= 3.4.0' },
        { es: '>= 3.0.0' },
      ] as ReadonlyArray<VersionConstraint>) {
        assert.equal(
          testEndpoint(GiteaEndpoint, constraint),
          false,
          `Gitea unexpectedly satisfied ${JSON.stringify(constraint)}`
        )
      }
    })

    it('does not mistake Gitea for github.com or ghe.com', () => {
      assert.equal(testEndpoint(GiteaEndpoint, { dotcom: true }), false)
      assert.equal(testEndpoint(GiteaEndpoint, { ghe: true }), false)
    })
  })
})

/** A registered instance from KnownGiteaInstances. */
const GiteaEndpoint = 'https://git.arcengames.com'

function testGitea(constraint: boolean) {
  return testEndpoint(GiteaEndpoint, { gitea: constraint })
}

function testDotCom(
  constraint: boolean,
  endpointVersion: string | SemVer | null = null
) {
  return testEndpoint(
    getDotComAPIEndpoint(),
    { dotcom: constraint, ghe: false, es: false },
    endpointVersion
  )
}

function testGHES(
  constraint: boolean | string,
  endpointVersion: string | SemVer | null = null
) {
  return testEndpoint(
    'https://ghe.io',
    { dotcom: false, ghe: false, es: constraint },
    endpointVersion
  )
}

function testGHEDotCom(constraint: boolean) {
  return testEndpoint('https://corp.ghe.com', {
    dotcom: false,
    ghe: constraint,
    es: false,
  })
}

function testEndpoint(
  endpoint: string,
  constraint: VersionConstraint,
  endpointVersion: string | SemVer | null = null
) {
  const version = endpointVersion
    ? forceUnwrap(`Couldn't parse endpoint version`, parse(endpointVersion))
    : null
  return endpointSatisfies(constraint, () => version)(endpoint)
}
