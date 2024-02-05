'use strict'

if (navigator.mediaDevices === undefined) {
  // @ts-ignore
  navigator.mediaDevices = {};
}
if (navigator.mediaDevices.getUserMedia === undefined) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    // @ts-ignore
    var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if (!getUserMedia) {
      return Promise.reject(
        new Error('getUserMedia is not implemented in this browser'),
      );
    }

    // 否则，为老的 navigator.getUserMedia 方法包裹一个 Promise
    return new Promise(function (resolve, reject) {
      getUserMedia.call(navigator, constraints, resolve, reject);
    });
  };
}

require('./dependencies/enc-base64-min');
// 音频转码worker
var recorderWorker = require('./dependencies/transformpcm.worker');
// var AudioContext = window.AudioContext || window.webkitAudioContext;
var md5 = require('./dependencies/md5');
var CryptoJSNew = require('./dependencies/HmacSHA1');
var CryptoJS = require('./dependencies/hmac-sha256');

// 记录处理的缓存音频
var mediaBuffers = [];

/**
 *
 * @Description: 类说明
 * @method XunFeiVoiceASR
 * @param object config  参数说明 语音助手开启和结束时调用的方法
 * @param Array textData  参数说明 语音指令集合
 * @param string appId  参数说明 讯飞实时语音转写接口appId
 * @param string apiKey  参数说明 讯飞实时语音转写接口apiKey
 */
module.exports = class XunFeiVoiceASR {
  constructor(config, appId, apiKey) {
    this.config = config;
    this.state = 'end';
    this.context = null
    this.recorder = null
    this.recorderStream = null
    this.ws = null
    this.temptext = ''
    this.wsLoadingState = false
    this.mediaStream = null

    // this.config.onMessage = (message) => {
    //   var text = setResult(JSON.parse(message));
    //   if (isFunction(this.config.onResult)) {
    //     this.config.onResult(text, message)
    //   }
    // };
    this.state = 'end';
    if (!appId || !isString(appId)) {
      if (isFunction(this.config.onError)) {
        this.stop();
        this.config.onError('appId为空或格式错误');
      }
      throw 'appId为空或格式错误'
    }
    if (!apiKey || !isString(apiKey)) {
      if (isFunction(this.config.onError)) {
        this.stop();
        this.config.onError('apiKey为空或格式错误');
      }
      throw 'apiKey为空或格式错误'
    }
    this.appId = appId;
    this.apiKey = apiKey;
  }

  start() {
    // this.stop();
    if (this.state === 'ing') {
      if (isFunction(this.config.onError)) {
        this.stop();
        this.config.onError('请勿重复开启');
      }
      return false
    }
    // if (currentUserMedia && AudioContext) {

    this.state = 'ing';
    if (!this.recorder) {
      const context = new AudioContext();
      this.context = context;
      const recorder = context.createScriptProcessor(0, 1, 1);
      this.recorder = recorder
      const getMediaSuccess = (stream) => {
        this.mediaStream = stream
        this.recorderStream = context.createMediaStreamSource(stream);
        recorder.onaudioprocess = (e) => {
          const voiceData = e.inputBuffer.getChannelData(0);
          this.sendData(voiceData);
          const maxVal = Math.max.apply(Math, voiceData);
          // 显示音量值
          if (isFunction(this.config.onVoiceVolume)) {
            this.config.onVoiceVolume(Math.round(maxVal * 100));
          }
        };
        this.connectWebsocket();
      };
      const getMediaFail = (e) => {
        this.recorder = null;
        this.recorderStream = null;
        this.context = null;
        if (isFunction(this.config.onError)) {
          this.stop();
          this.config.onError('请求麦克风失败', e);
        }
        throw e
      };

      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: false,
        })
        .then((stream) => {
          if (isFunction(this.config.onUserMedia)) {
            this.config.onUserMedia(stream);
          }
          getMediaSuccess(stream);
        })
        .catch((e) => {
          getMediaFail(e);
        });
    } else {
      this.connectWebsocket();
    }
    // } else {
    //   if (isFunction(this.config.onError)) {
    //     this.stop();
    //     this.config.onError('浏览器不支持');
    //   }
    // }
  }

  stop() {
    this.state = 'end';
    if (this.recorder) {
      try {
        if (this.recorderStream) {
          this.recorderStream.disconnect(this.recorder);
        }
        if (this.context) {
          this.recorder.disconnect(this.context.destination);
        }
      } catch (error) {
        console.error('断开错误', error)
      }
    }

    if (isFunction(this.config.onVoiceVolume)) {
      this.config.onVoiceVolume(0);
    }

    setTimeout(() => {
      if (isFunction(this.config.onClose)) {
        this.config.onClose();
      }
    }, 256);
  }

  sendData(buffer) {
    var data = {
      command: 'transform',
      buffer: buffer,
    };
    mediaBuffers = recorderWorker.onmessage(data) || [];
  };

  // 生成握手参数
  getHandShakeParams() {
    const appId = this.appId;
    const secretKey = this.apiKey;
    const ts = Math.floor(new Date().getTime() / 1000); /* new Date().getTime()/1000+''; */
    const signa = md5.hex_md5(appId + ts); // hex_md5(encodeURIComponent(appId + ts));//EncryptUtil.HmacSHA1Encrypt(EncryptUtil.MD5(appId + ts), secretKey);
    const signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey);
    var signature = CryptoJS.enc.Base64.stringify(signatureSha);
    signature = encodeURIComponent(signature);
    return `?appid=${appId}&ts=${ts}&signa=${signature}`;
  }

  connectWebsocket() {
    var url = 'wss://rtasr.xfyun.cn/v1/ws';
    const urlParam = this.getHandShakeParams();

    url = `${url}${urlParam}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = (e) => {
      if (this.recorder) {
        if (this.recorderStream) {
          this.recorderStream.connect(this.recorder);
        }
        if (this.context) {
          this.recorder.connect(this.context.destination);
        }
      }
      setTimeout(() => {
        this.wsOpened();
      }, 256);
      if (isFunction(this.config.onWebSocketOpen)) {
        this.config.onWebSocketOpen(e);
      }
    };
    this.ws.onmessage = (e) => {
      if (isFunction(this.config.onWebSocketMessage)) {
        this.config.onWebSocketMessage(e);
      }
      setTimeout(() => {
        this.wsOnMessage(e);
      }, 64)
    };
    this.ws.onerror = (e) => {
      this.stop();
      if (isFunction(this.config.onWebSocketError)) {
        this.config.onWebSocketError(e);
      }
      if (isFunction(this.config.onError)) {
        this.config.onError('WebSocket连接错误', e);
      }
    };
    this.ws.onclose = (e) => {
      if (isFunction(this.config.onWebSocketClose)) {
        this.config.onWebSocketClose(e);
      }
      this.stop();
      // if (isFunction(this.config.onResult)) {
      //   this.config.onResult(this.temptext)
      // }
    };
  }

  wsOpened() {
    if (!this.ws) {
      this.onError('WebSocket连接失败');
      this.stop()
      return
    }
    // websocket未连接
    if (this.ws.readyState !== 1) {
      this.onError('WebSocket连接状态异常', this.ws.readyState);
      return;
    }

    const audioData = mediaBuffers.splice(0, 1280);
    this.ws.send(new Int8Array(audioData));
    this.handlerInterval = setInterval(() => {
      if (this.ws) {
        // websocket未连接
        if (this.ws.readyState !== 1) {
          this.stop()
          clearInterval(this.handlerInterval);
          return;
        }
        if (mediaBuffers.length === 0) {
          if (this.state === 'end') {
            this.ws.send('{"end": true}');
            clearInterval(this.handlerInterval);
          }
          return;
        }
        const voiceData = mediaBuffers.splice(0, 1280);
        if (voiceData.length > 0) {
          this.ws.send(new Int8Array(voiceData));
        }
      }
    }, 40);
  }

  wsOnMessage(e) {
    var jsonData = null
    try {
      jsonData = JSON.parse(e.data);
    } catch (error) {
      jsonData = null
    }

    if (!jsonData) {
      this.onError('数据解析错误', e)
      return
    }

    if (jsonData.action == 'started') {
      // 握手成功
      this.temptext = ''
      this.wsLoadingState = true
    } else if (jsonData.action == 'result') {
      // 转写结果
      // if (isFunction(this.config.onMessage)) {
      //   this.config.onMessage(jsonData.data);
      // }
      var text = setResult(JSON.parse(jsonData.data));
      this.temptext = this.temptext + text
      if (isFunction(this.config.onMessage)) {
        this.config.onMessage(text, jsonData)
      }

      if (this.state === 'end') {
        if (this.wsLoadingState) {
          this.wsLoadingState = false
          if (isFunction(this.config.onResult)) {
            this.config.onResult(this.temptext, jsonData)
          }
        }
      }

    } else if (jsonData.action == 'error') {
      // 连接发生错误
      this.stop()
      this.onError('连接数据错误', e)
      throw e
    }
  }

  onError(info, event) {
    if (isFunction(this.config.onError)) {
      this.config.onError(info, event);
    }
  }
};


/**
 * 从讯飞语音识别引擎返回参数筛选出识别结果
 * @method setResult
 * @param data 讯飞语音识别引擎返回结果
 * @return number | string  返回值说明 语音识别结果
 */
function setResult(data) {
  var rtasrResult = [];
  rtasrResult[data.seg_id] = data;
  let str = '';
  rtasrResult.forEach(i => {
    if (i.cn.st.type == 0) {
      i.cn.st.rt.forEach(j => {
        j.ws.forEach(k => {
          k.cw.forEach(l => {
            str += l.w
          })
        })
      });
    }
  });
  return str
}

/**
 * 是否函数
 * @param val
 * @returns boolean
 */
function isFunction(val) {
  return typeof val === 'function'
}

/**
 * 是否字符串
 * @param val
 * @returns boolean
 */
function isString(val) {
  return typeof val === 'string'
}
