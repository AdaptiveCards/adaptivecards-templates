import React from 'react';

// Libraries
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import { PrimaryButton } from 'office-ui-fabric-react'
import { SearchBox } from 'office-ui-fabric-react';

// Components
import AdaptiveCard from '../AdaptiveCard';

// Styles
import {
  BackDrop,
  Modal,
  Header,
  Description,
  DescriptionAccent,
  CenterPanelWrapper,
  CenterPanelLeft,
  AdaptiveCardPanel,
  CenterPanelRight,
  SemiBoldText,
  BottomRow,
  NotifiedGroup,
  ButtonGroup,
  CancelButton,
} from './styled';

interface Props {
  template: any;
  toggleModal: () => void;
}

class PublishModal extends React.Component<Props> {

  publish = () => {
    // TODO: USE CLIENT SDK TO PUBLISH
  }

  render() {
    const { template } = this.props;

    return (
      <BackDrop>
        <Modal>
          <Header>Publish Template</Header>
          <Description>Your template design will be sent for review. Once approved, your new design will go live as <DescriptionAccent>{template.name}</DescriptionAccent></Description>
          <CenterPanelWrapper>
            <CenterPanelLeft>
              <AdaptiveCardPanel>
                <AdaptiveCard cardtemplate={template} />
              </AdaptiveCardPanel>
              <SemiBoldText>
                Notified
              </SemiBoldText>
              <SearchBox placeholder="Search for people" />
            </CenterPanelLeft>
            <CenterPanelRight>
              <TextField label="Comments" placeholder="Enter any comments you may have for your reviewers to see. (Optional)" multiline autoAdjustHeight />
            </CenterPanelRight>
          </CenterPanelWrapper>
          <BottomRow>
            <NotifiedGroup>
              FACES HERE
            </NotifiedGroup>
            <ButtonGroup>
              <CancelButton text="Cancel" onClick={this.props.toggleModal} />
              <PrimaryButton text="Publish" onClick={this.publish} />
            </ButtonGroup>
          </BottomRow>
        </Modal>
      </BackDrop>
    );
  }
}

export default PublishModal;
