import React from 'react';
import { fireEvent, waitForElement } from '@testing-library/dom';
import { Status } from 'shared/types';
import { BitcoindLibrary, DockerLibrary } from 'types';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import { createBitcoindNetworkNode } from 'utils/network';
import {
  getNetwork,
  injections,
  lightningServiceMock,
  renderWithProviders,
  suppressConsoleErrors,
  testNodeDocker,
} from 'utils/tests';
import RemoveNode from './RemoveNode';

const dockerServiceMock = injections.dockerService as jest.Mocked<DockerLibrary>;
const bitcoindServiceMock = injections.bitcoindService as jest.Mocked<BitcoindLibrary>;

describe('RemoveNode', () => {
  const renderComponent = (status?: Status, useBitcoinNode = false) => {
    const network = getNetwork(1, 'test network', status);
    if (status === Status.Error) {
      network.nodes.lightning.forEach(n => (n.errorMsg = 'test-error'));
    }
    const btcLatest = defaultRepoState.images.bitcoind.latest;
    network.nodes.bitcoin.push(
      createBitcoindNetworkNode(network, btcLatest, testNodeDocker),
    );
    const initialState = {
      network: {
        networks: [network],
      },
      designer: {
        allCharts: {
          1: initChartFromNetwork(network),
        },
        activeId: 1,
      },
    };
    const { lightning, bitcoin } = network.nodes;
    const node = useBitcoinNode
      ? bitcoin[0]
      : lightning[status === Status.Started ? 0 : 1];
    const cmp = <RemoveNode node={node} />;
    return renderWithProviders(cmp, { initialState, wrapForm: true });
  };

  describe('lightning node', () => {
    beforeEach(() => {
      lightningServiceMock.getChannels.mockResolvedValue([]);
    });

    it('should show the remove node modal', async () => {
      const { getByText } = renderComponent(Status.Started);
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      expect(
        getByText('Are you sure you want to remove alice from the network?'),
      ).toBeInTheDocument();
      expect(getByText('Yes')).toBeInTheDocument();
      expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('should remove the node with the network stopped', async () => {
      const { getByText, getByLabelText } = renderComponent(Status.Started);
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(getByText('Yes'));
      // wait for the error notification to be displayed
      await waitForElement(() => getByLabelText('check-circle'));
      expect(
        getByText('The node alice has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.removeNode).toBeCalledTimes(1);
    });

    it('should remove the node with the network started', async () => {
      const { getByText, getByLabelText } = renderComponent(Status.Started);
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(getByText('Yes'));
      // wait for the error notification to be displayed
      await waitForElement(() => getByLabelText('check-circle'));
      expect(
        getByText('The node alice has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.removeNode).toBeCalledTimes(1);
    });

    it('should display an error if removing the node fails', async () => {
      // antd Modal.confirm logs a console error when onOk fails
      // this suppresses those errors from being displayed in test runs
      await suppressConsoleErrors(async () => {
        dockerServiceMock.removeNode.mockRejectedValue(new Error('test error'));
        const { getByText, getByLabelText } = renderComponent(Status.Started);
        expect(getByText('Remove')).toBeInTheDocument();
        fireEvent.click(getByText('Remove'));
        fireEvent.click(getByText('Yes'));
        // wait for the error notification to be displayed
        await waitForElement(() => getByLabelText('close-circle'));
        expect(getByText('Unable to remove the node')).toBeInTheDocument();
        expect(getByText('test error')).toBeInTheDocument();
      });
    });
  });

  describe('bitcoin node', () => {
    beforeEach(() => {
      lightningServiceMock.getChannels.mockResolvedValue([]);
      lightningServiceMock.waitUntilOnline.mockResolvedValue(Promise.resolve());
      bitcoindServiceMock.waitUntilOnline.mockResolvedValue(Promise.resolve());
    });

    it('should show the remove node modal', async () => {
      const { getByText } = renderComponent(Status.Started, true);
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      expect(
        getByText('Are you sure you want to remove backend1 from the network?'),
      ).toBeInTheDocument();
      expect(getByText('Yes')).toBeInTheDocument();
      expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('should remove the node with the network stopped', async () => {
      const { getByText, getByLabelText } = renderComponent(Status.Stopped, true);
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(getByText('Yes'));
      // wait for the error notification to be displayed
      await waitForElement(() => getByLabelText('check-circle'));
      expect(
        getByText('The node backend1 has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.saveComposeFile).toBeCalledTimes(1);
    });

    it('should remove the node with the network started', async () => {
      const { getByText, getByLabelText } = renderComponent(Status.Started, true);
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(getByText('Yes'));
      // wait for the error notification to be displayed
      await waitForElement(() => getByLabelText('check-circle'));
      expect(
        getByText('The node backend1 has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.saveComposeFile).toBeCalledTimes(2);
    });

    it('should display an error if removing the node fails', async () => {
      // antd Modal.confirm logs a console error when onOk fails
      // this suppresses those errors from being displayed in test runs
      await suppressConsoleErrors(async () => {
        dockerServiceMock.saveComposeFile.mockRejectedValue(new Error('test error'));
        const { getByText, getByLabelText } = renderComponent(Status.Stopped, true);
        expect(getByText('Remove')).toBeInTheDocument();
        fireEvent.click(getByText('Remove'));
        fireEvent.click(getByText('Yes'));
        // wait for the error notification to be displayed
        await waitForElement(() => getByLabelText('close-circle'));
        expect(getByText('Unable to remove the node')).toBeInTheDocument();
        expect(getByText('test error')).toBeInTheDocument();
      });
    });
  });
});
