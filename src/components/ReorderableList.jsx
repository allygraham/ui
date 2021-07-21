import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { Button, Space } from 'antd';
import { UpOutlined, DownOutlined } from '@ant-design/icons';

const ReorderableList = (props) => {
  const {
    onChange, defaultList, listValue, leftItem, rightItem,
  } = props;
  const [reorderableList, setReorderableList] = useState(listValue ?? defaultList ?? []);

  useEffect(() => {
    setReorderableList(listValue);
  }, [listValue]);

  const moveUp = (source, id) => {
    const index = source.findIndex((e) => e.key === id);

    const arr = [...source];

    if (index <= 0) {
      return arr;
    }

    const el = arr[index];
    arr[index] = arr[index - 1];
    arr[index - 1] = el;

    setReorderableList(arr);

    return arr;
  };

  const moveDown = (source, id) => {
    const index = source.findIndex((e) => e.key === id);

    const arr = [...source];

    if (index === -1 || index >= source.length - 1) {
      return arr;
    }

    const el = arr[index];
    arr[index] = arr[index + 1];
    arr[index + 1] = el;

    setReorderableList(arr);

    return arr;
  };

  const upButton = (key, currentPosition) => (
    <Button
      size='small'
      shape='circle'
      disabled={currentPosition === 0}
      icon={<UpOutlined />}
      style={{ marginLeft: '5px' }}
      onClick={() => {
        onChange(moveUp(reorderableList, key));
      }}
    />
  );

  const downButton = (key, currentPosition) => (
    <Button
      size='small'
      shape='circle'
      disabled={currentPosition === reorderableList.length - 1}
      icon={<DownOutlined />}
      style={{ marginRight: '5px' }}
      onClick={() => {
        onChange(moveDown(reorderableList, key));
      }}
    />
  );

  const composeItem = (itemData, i) => (
    <div key={i}>
      {leftItem(itemData, i)}

      {upButton(itemData.key, i)}
      {downButton(itemData.key, i)}

      {rightItem(itemData, i)}
    </div>
  );

  return (
    <Space direction='vertical'>
      {reorderableList.map((itemData, i) => (
        composeItem(itemData, i)
      ))}
    </Space>
  );
};

ReorderableList.propTypes = {
  onChange: PropTypes.func.isRequired,
  defaultList: PropTypes.array,
  listValue: PropTypes.array,
  leftItem: () => { },
  rightItem: () => { },
};

ReorderableList.defaultProps = {
  defaultList: null,
  listValue: null,
  leftItem: () => { },
  rightItem: () => { },
};

export default ReorderableList;
