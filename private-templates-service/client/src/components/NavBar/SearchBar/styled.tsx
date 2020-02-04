import styled from 'styled-components';
import { SearchBox,} from 'office-ui-fabric-react';
import {BREAK} from '../../../globalStyles';

export const StyledSearchBox = styled(SearchBox)`
  width: 50%;
  border-color: #5c5c5c;

  @media only screen and (max-width: ${BREAK.SM}px){
    border-radius: 16px;
    width: 33%;
    
    :hover {
      border-radius: 0px;
    }
  }
`;