import * as React from 'react'
import { Form } from '../lib/form'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Ref } from '../lib/ref'
import { LinkButton } from '../lib/link-button'
import { Row } from '../lib/row'
import { getHTMLURL } from '../../lib/api'

/**
 * Token sign-in for Gitea, shared by both sign-in surfaces.
 *
 * There are two of them -- the Preferences dialog (`ui/sign-in/sign-in.tsx`)
 * and the Welcome flow (`ui/lib/sign-in.tsx`) -- and they render entirely
 * separate component trees. Wiring only one is a silent hole: the other keeps
 * showing the browser button and the user gets no token field at all. Hence a
 * single shared implementation rather than parallel copies.
 *
 * The dialog supplies its own submit affordance in the dialog footer, so it
 * embeds `GiteaTokenFields` directly. The Welcome flow has no footer and uses
 * `GiteaTokenForm`, which adds the form and submit button.
 */

interface IGiteaTokenFieldsProps {
  readonly endpoint: string
  readonly value: string
  readonly onValueChanged: (value: string) => void

  /** Rendered after the token field. */
  readonly children?: React.ReactNode
}

export class GiteaTokenFields extends React.Component<IGiteaTokenFieldsProps> {
  public render() {
    const htmlURL = getHTMLURL(this.props.endpoint)
    const tokenURL = new URL('/user/settings/applications', htmlURL).toString()

    return (
      <>
        <p>
          Sign in to <Ref>{htmlURL}</Ref> with a personal access token. Generate
          one under Settings &rarr; Applications, granting it the{' '}
          <Ref>repository</Ref> and <Ref>user</Ref> scopes.
        </p>
        <Row>
          <TextBox
            label="Personal access token"
            value={this.props.value}
            onValueChanged={this.props.onValueChanged}
            type="password"
            autoFocus={true}
          />
        </Row>
        <p className="secondary-text">
          <LinkButton uri={tokenURL}>Create a token</LinkButton>
        </p>
        {this.props.children}
      </>
    )
  }
}

interface IGiteaTokenFormProps {
  readonly endpoint: string
  readonly loading: boolean
  readonly onSubmit: (token: string) => void

  /** Additional buttons rendered beside "Sign in", e.g. Cancel. */
  readonly additionalButtons?: ReadonlyArray<JSX.Element>
}

interface IGiteaTokenFormState {
  readonly token: string
}

export class GiteaTokenForm extends React.Component<
  IGiteaTokenFormProps,
  IGiteaTokenFormState
> {
  public constructor(props: IGiteaTokenFormProps) {
    super(props)
    this.state = { token: '' }
  }

  public render() {
    return (
      <Form className="sign-in-form" onSubmit={this.onSubmit}>
        <GiteaTokenFields
          endpoint={this.props.endpoint}
          value={this.state.token}
          onValueChanged={this.onTokenChanged}
        />
        <Button
          type="submit"
          disabled={this.props.loading || this.state.token.length === 0}
        >
          Sign in
        </Button>
        {this.props.additionalButtons}
      </Form>
    )
  }

  private onTokenChanged = (token: string) => {
    this.setState({ token })
  }

  private onSubmit = () => {
    if (this.state.token.length > 0) {
      this.props.onSubmit(this.state.token)
    }
  }
}
