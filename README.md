# xunfei-voice-asr(讯飞语音实时转写API封装库)

## 引入

1.import方式
```js
  import XunFeiVoiceAsr from 'xunfei-voice-asr';
```

2.require方式
```js
  const XunFeiVoiceAsr = require('xunfei-voice-asr');
```

## 使用

```js
  let voiceAsr = new XunFeiVoiceAsr(config, appId, apiKey);
  // 开启实时语音
  voiceAsr.start()
  // 关闭实时语音
  voiceAsr.stop()
```

## 构造语音助手时候输入参数解释

config 示例：
```js
const config = {
  // ws启动时回调
  onWebSocketOpen: (res) => {
    console.log('onWebSocketOpen', res);
  },
  // ws数据交互时回调
  onWebSocketMessage: (res) => {
    console.log('onWebSocketMessage', res);
  },
  // ws关闭时回调
  onWebSocketClose: (res) => {
    console.log('onWebSocketClose', res);
  },
  // ws错误时回调
  onWebSocketError: (res) => {
    console.log('onWebSocketError', res);
  },
  // 初始化录音成功时回调
  onInitUserMedia: (stream) => {
    console.log('onInitUserMedia', stream);
  },
  // 关闭时回调
  onClose: (res) => {
    console.log('onClose', res);
  },
  // 错误时回调
  onError: (res, err) => {
    console.log('onError', res, err);
  },
  // 实时分贝值回调
  onVoiceVolume: (res) => {
    console.log('onVoiceVolume', res);
  },
  // 返回结果
  onResult: (res, message) => {
    console.log('onResult', res, message);
  },
};
```

appId [查看下方文档](#讯飞语音实时转写接口文档)

apiKey [查看下方文档](#讯飞语音实时转写接口文档)

### 讯飞语音实时转写接口文档
===> [接口文档地址](https://www.xfyun.cn/doc/asr/rtasr/API.html)

### 讯飞接口错误码
===> [接口错误码文档地址](https://www.xfyun.cn/document/error-code)
