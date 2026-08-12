import { Repository } from '../models/repository'
import { getDotComAPIEndpoint } from './api'
import { GitHubRepository } from '../models/github-repository'
import { Owner } from '../models/owner'
import { getRepositorySlug } from '../../package-info'

// HACK: This is needed because the `Rich`Text` component needs to know what
// repo to link issues against. Used when we can't rely on the repo info we keep
// in state because we it need Desktop specific, so we've stubbed out this repo
//
// Fork: pointed at our repository rather than desktop/desktop. This backs the
// release notes and thank-you dialogs, so a "#123" in our changelog would
// otherwise link to an unrelated issue in upstream's tracker.
const [forkOwner, forkName] = getRepositorySlug().split('/')

const desktopOwner = new Owner(forkOwner, getDotComAPIEndpoint(), -1)
const desktopUrl = `https://github.com/${getRepositorySlug()}`
export const DesktopFakeRepository = new Repository(
  '',
  -1,
  new GitHubRepository(forkName, desktopOwner, -1, false, desktopUrl),
  true
)
