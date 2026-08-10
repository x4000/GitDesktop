import * as React from 'react'
import { Octicon, OcticonSymbol } from '../octicons'
import { TooltippedContent } from '../lib/tooltipped-content'
import { TooltipDirection } from '../lib/tooltip'

interface ICurrentRepositoryLabelProps {
  readonly icon: OcticonSymbol
  readonly title: string

  /** Shown as a tooltip. Absent for cloning repositories, which have no path. */
  readonly path?: string

  readonly onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void
}

/**
 * Shows which repository is currently selected.
 *
 * Replaces upstream's repository ToolbarDropdown. With the repository list
 * permanently on screen the dropdown had nothing left to do, but the name is
 * still worth having in the toolbar: the list shows the selection as a
 * highlight, which is easy to lose track of once it scrolls.
 *
 * Deliberately not a button. It is not interactive except for the context
 * menu, which upstream also offers here, so presenting it as clickable would
 * promise an action that no longer exists.
 */
export class CurrentRepositoryLabel extends React.Component<ICurrentRepositoryLabelProps> {
  public render() {
    return (
      <div
        className="fork-current-repository-label"
        onContextMenu={this.props.onContextMenu}
      >
        <TooltippedContent
          tooltip={this.props.path}
          direction={TooltipDirection.SOUTH}
        >
          <Octicon symbol={this.props.icon} />
          <span className="title">{this.props.title}</span>
        </TooltippedContent>
      </div>
    )
  }
}
