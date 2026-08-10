import * as React from 'react'
import { Resizable } from '../resizable'
import { clamp } from '../../lib/clamp'
import { getNumber, setNumber } from '../../lib/local-storage'

/**
 * A permanently visible repository list down the left-hand side, replacing
 * upstream's toolbar foldout.
 *
 * Width lives here rather than in AppStore. AppStore owns the widths of the
 * other resizable panes and budgets them against each other in
 * `updateResizableConstraints`, which would be the consistent place to put
 * this -- but it is also upstream's single hottest file, and every line we add
 * to it is a line we hand-merge roughly monthly. A self-contained width with
 * its own persistence costs us a slightly less clever layout budget and no
 * ongoing merge tax. See docs/fork/MERGING.md.
 *
 * The tradeoff: this pane is not part of the global width budget, so it clamps
 * itself against the window instead (see `getMaximumWidth`).
 */

const WidthConfigKey = 'fork-repository-sidebar-width'
const DefaultWidth = 250
const MinimumWidth = 200

/**
 * Never let the sidebar squeeze the rest of the app into nothing. AppStore
 * reserves room for the toolbar buttons and the diff pane when it budgets its
 * own panes; this is the same idea with a cruder measure.
 */
const MinimumRemainingWidth = 500

interface IRepositorySidebarProps {
  /** The repository list, rendered by AppStore's owner. */
  readonly children: React.ReactNode
}

interface IRepositorySidebarState {
  readonly width: number
  readonly availableWidth: number
}

export class RepositorySidebar extends React.Component<
  IRepositorySidebarProps,
  IRepositorySidebarState
> {
  public constructor(props: IRepositorySidebarProps) {
    super(props)

    this.state = {
      width: getNumber(WidthConfigKey, DefaultWidth),
      availableWidth: window.innerWidth,
    }
  }

  public componentDidMount() {
    window.addEventListener('resize', this.onWindowResize)
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.onWindowResize)
  }

  private onWindowResize = () => {
    this.setState({ availableWidth: window.innerWidth })
  }

  private getMaximumWidth() {
    // Guard against a narrow window making the maximum smaller than the
    // minimum, which would leave the pane unresizable in both directions.
    return Math.max(
      MinimumWidth,
      this.state.availableWidth - MinimumRemainingWidth
    )
  }

  private onResize = (width: number) => {
    const clamped = clamp(width, MinimumWidth, this.getMaximumWidth())
    this.setState({ width: clamped })
    setNumber(WidthConfigKey, clamped)
  }

  private onReset = () => {
    this.setState({ width: DefaultWidth })
    setNumber(WidthConfigKey, DefaultWidth)
  }

  public render() {
    return (
      <Resizable
        id="fork-repository-sidebar"
        width={clamp(this.state.width, MinimumWidth, this.getMaximumWidth())}
        minimumWidth={MinimumWidth}
        maximumWidth={this.getMaximumWidth()}
        onResize={this.onResize}
        onReset={this.onReset}
        description="Repository list"
      >
        {this.props.children}
      </Resizable>
    )
  }
}
