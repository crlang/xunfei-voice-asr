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
  // 启动时回调
  onStart: (err) => {
    console.log('onStart', err);
  },
  // 关闭时回调
  onClose: (err) => {
    console.log('onClose', err);
  },
  // 错误时回调
  onError: (err) => {
    console.log('onError', err);
  },
  // 数据交互时回调
  onVoiceMessage: (err) => {
    console.log('onVoiceMessage', err);
  },
  // 实时分贝值回调
  onVoiceVolume: (err) => {
    console.log('onVoiceVolume', err);
  },
  // 返回结果
  onResult: (err) => {
    console.log('onResult', err);
  },
};
```

appId [查看下方文档](#讯飞语音实时转写接口文档)

apiKey [查看下方文档](#讯飞语音实时转写接口文档)

### 讯飞语音实时转写接口文档
===> [接口文档地址](https://www.xfyun.cn/doc/asr/rtasr/API.html)

### 讯飞接口错误码
===> [接口错误码文档地址](https://www.xfyun.cn/document/error-code)
