import * as React from 'react'
import { LinkButton } from '../lib/link-button'
import { CopyButton } from '../copy-button'

interface IDeviceFlowInstructionsProps {
  readonly userCode: string
  readonly verificationUri: string
}

/**
 * The user-facing half of the GitHub device flow: a short code, and where to
 * type it.
 *
 * The code is the entire point of this screen. The browser opens on top of the
 * app and takes focus, so anything not read before that happens is effectively
 * invisible -- hence the code being the largest thing here, and copyable.
 */
export class DeviceFlowInstructions extends React.Component<IDeviceFlowInstructionsProps> {
  public render() {
    return (
      <div className="fork-device-flow">
        <p>
          Enter this code at{' '}
          <LinkButton uri={this.props.verificationUri}>
            {this.props.verificationUri.replace(/^https?:\/\//, '')}
          </LinkButton>{' '}
          to finish signing in. Your browser should have opened there already.
        </p>

        <div className="user-code">
          {/*
            The visible code is hidden from screen readers in favour of the
            spaced-out version below it. Read as a word, "WDJB-MJHT" is no use
            to someone who has to transcribe it character by character.
          */}
          <span className="code" aria-hidden={true}>
            {this.props.userCode}
          </span>
          <span className="sr-only">
            Your code is {this.userCodeForScreenReaders()}
          </span>
          <CopyButton
            ariaLabel="Copy sign in code"
            copyContent={this.props.userCode}
          />
        </div>

        <p className="secondary-text">
          This dialog will close on its own once you have authorized.
        </p>
      </div>
    )
  }

  /**
   * Screen readers run the code together as a word, which is unusable for
   * something the user has to transcribe. Spacing the characters makes it
   * read out one at a time.
   */
  private userCodeForScreenReaders() {
    return this.props.userCode.split('').join(' ')
  }
}
