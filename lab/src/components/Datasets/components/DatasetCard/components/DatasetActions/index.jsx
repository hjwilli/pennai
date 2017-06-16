import React, { Component } from 'react';
import { Checkbox, Dropdown, Icon } from 'semantic-ui-react';

class DatasetActions extends Component {
	constructor(props) {
		super(props);

		this.onToggleAI = this.onToggleAI.bind(this);
	}

	onToggleAI() {
		const { dataset, toggleAI } = this.props;
		const aiState = dataset.get('ai');
		const aiNextState = !aiState ? 'requested' : false;

		toggleAI(dataset.get('_id'), aiNextState);
	}

	render() {

		const { 
			dataset
		} = this.props;

		const hasMetadata = dataset.get('has_metadata');

		const aiState = dataset.get('ai');

		const aiLabelText = aiState === 'requested' ? 'AI requested' : aiState ? 'AI on' : 'AI off';

		const aiLabelClass = `ai-label ${aiState ? 'on' : 'off' }`;

		const aiToggleClass = aiState === 'requested' ? 'ai-switch requested' : 'ai-switch';

		const aiIsChecked = !aiState ? false : true;

		const aiIsToggling = dataset.get('isTogglingAI');

		const dropdownIcon = <Icon inverted color="grey" size="large" name="caret down" />;

		return (
			<span>
				{hasMetadata &&
					<span>
						<span className={aiLabelClass}>
							{aiLabelText}
						</span>
						<Checkbox
							toggle 
							checked={aiIsChecked}
							className={aiToggleClass}
							onChange={this.onToggleAI}
							disabled={aiIsToggling}
						/>
					</span>	
				}
				<Dropdown pointing="top right" icon={dropdownIcon}>
					<Dropdown.Menu>
						<Dropdown.Item icon="file" text="Replace file" />
						<Dropdown.Item icon="trash" text="Delete" />
					</Dropdown.Menu>
				</Dropdown>
			</span>
		);
	}
}

export default DatasetActions;