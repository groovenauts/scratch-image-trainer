/**
 * @license
 * Copyright 2019 Groovenauts, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as tf from '@tensorflow/tfjs';

import formatMessage from "format-message";
import React, { useState, useEffect, useRef, useReducer } from 'react';
import ReactDOM from 'react-dom';

import modelSaveHandler from "./modelSave";

const postURL = "https://scratch-image-model-dot-ai-for-edu.appspot.com/models";

let translations = {
  "ja": {
    "headerMessage": "スクラッチに写真をおぼえさせよう!",
    "train": "トレーニング",
    "save": "アップロード",
    "accessKey": "カギをゲットした",
  },
  "en": {
    "headerMessage": "Teach scratch with photos!",
    "train": "Train",
    "save": "Upload",
    "accessKey": "You got a key",
  }
};

formatMessage.setup({
    locale: "ja-JP",
    translations: translations,
    missingTranslation: "ignore",
});

const MAX_LABELS = 10;

const Header = () => {
    return <header>
        <div>{formatMessage({
                            id: "headerMessage",
                            default: "スクラッチに写真をおぼえさせよう!",
                            description: "Text message in header."
        })}</div>
        </header>;
}

const IMAGE_SIZE = 224;

class Action {
    constructor(public type: string,
                public data: any){
        this.type = type;
        this.data = data;
    }
}

const WebCam = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    const [ videoSize, setVideoSize ] = useState([320, 240]);

    let stopCallback = null;

    function handleStream(stream) {
        if (props.webcamRef.current) {
            props.webcamRef.current.srcObject = stream;
            stopCallback = () => {
                stream.getVideoTracks().forEach((tr) => { tr.stop(); });
            }
        }
    }

    function handleVideoSize() {
        const elm = props.webcamRef.current;
        const aspectRatio = elm.videoWidth / elm.videoHeight;
        let newSize = [IMAGE_SIZE, IMAGE_SIZE];
        if (aspectRatio >= 1) {
            newSize = [Math.ceil(IMAGE_SIZE * aspectRatio), IMAGE_SIZE];
        } else {
            newSize = [IMAGE_SIZE, Math.ceil(IMAGE_SIZE / aspectRatio)];
        }
        if (videoSize[0] !== newSize[0] || videoSize[1] !== newSize[1]) {
            setVideoSize(newSize);
        }
    }

    useEffect(() => {
        const navigatorAny = navigator;
        navigator.getUserMedia = navigator.getUserMedia ||
            navigatorAny.webkitGetUserMedia || navigatorAny.mozGetUserMedia ||
            navigatorAny.msGetUserMedia;
        if (appInfo.videoFlag && navigator.getUserMedia) {
            navigator.getUserMedia({video: {facingMode: "environment"}}, handleStream, () => null);
            return () => {
                if (stopCallback) {
                    stopCallback();
                }
            };
        } else {
            return;
        }
    }, [appInfo.videoFlag]);

    const webcamClassNames = [ "webcam" ];
    if (appInfo.flipMode) {
        webcamClassNames.push("flip-image");
    }

    const toggleVideoFlag = () => {
        dispatch(new Action("setVideoFlag", !appInfo.videoFlag));
    };

    return <div className="webcam-container">
        <div className="webcam-box-outer">
          <div className="webcam-box-inner">
            <video autoPlay playsInline muted className={webcamClassNames.join(" ")} width={videoSize[0]} height={videoSize[1]} onLoadedData={handleVideoSize} ref={props.webcamRef} ></video>
          </div>
        <div className="webcam-controller">
          { appInfo.videoFlag ?
              <button className="mdl-button mdl-js-button mdl-button--raised mdl-button--accent" onClick={toggleVideoFlag} ><i className="material-icons">pause</i></button> :
              <button className="mdl-button mdl-js-button mdl-button--raised mdl-button--accent" onClick={toggleVideoFlag} ><i className="material-icons">play_circle_filled</i></button>}
        </div>
        </div>
      </div>
}

function cropImage(img) {
    const size = Math.min(img.shape[0], img.shape[1]);
    const centerHeight = Math.floor(img.shape[0] / 2);
    const beginHeight = centerHeight - Math.floor(size / 2);
    const centerWidth = Math.floor(img.shape[1] / 2);
    const beginWidth = centerWidth - Math.floor(size / 2);
    return img.slice([beginHeight, beginWidth, 0], [size, size, 3]);
}

function capture(ref) {
    const video = ref.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.width;
    canvas.height = video.height;
    const context = canvas.getContext("2d");
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return tf.tidy(() => {
        // Reads the image as a Tensor from the webcam <video> element.
        const webcamImage = tf.browser.fromPixels(canvas);

        // Crop the image so we're using the center square of the rectangular
        // webcam.
        const croppedImage = cropImage(webcamImage);

        // Expand the outer most dimension so we have a batch size of 1.
        const batchedImage = croppedImage.expandDims(0);

        // Normalize the image between -1 and 1. The image comes in between 0-255,
        // so we divide by 127 and subtract 1.
        const offset = tf.scalar(127.5);
        return batchedImage.toFloat().sub(offset).div(offset);
    });
}

function convertToImageData(image) {
    const [width, height] = [IMAGE_SIZE, IMAGE_SIZE];
    const imageData = new ImageData(width, height);
    const data = image.dataSync();
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const j = ((width-1-x) + y * width) * 4;
            imageData.data[j + 0] = (data[(y * width + x) * 3 + 0] + 1) * 127;
            imageData.data[j + 1] = (data[(y * width + x) * 3 + 1] + 1) * 127;
            imageData.data[j + 2] = (data[(y * width + x) * 3 + 2] + 1) * 127;
            imageData.data[j + 3] = 255;
        }
    }
    return imageData;
}

function drawCanvas(imageData, canvasRef) {
    const ctx = canvasRef.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
}

const Selector = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    const tensors = appInfo.tensors[props.index];

    const [capturing, setCapturing] = useState(false);
    const canvasRef = useRef();

    useEffect(() => {
        if (props.imageData) {
            drawCanvas(props.imageData, canvasRef.current);
        }
    }, [props.imageData]);

    useEffect(() => {
        const addSample = () => {
            const image = capture(props.webcamRef);
            const imData = convertToImageData(image);
            dispatch(new Action("setSampleImage", { index: props.index, image: imData}));
            const embedding = tf.tidy(() => appInfo.mobileNet.predict([image]));
            image.dispose();
            if (tensors == null) {
                dispatch(new Action("setTensor", { index: props.index, tensor: embedding }));
            } else {
                // previous tensor will disposed via useEffect() cleanup in Main components.
                const newTensors = tf.tidy(() => tf.concat([tensors, embedding], 0));
                embedding.dispose();
                dispatch(new Action("setTensor", { index: props.index, tensor: newTensors }));
            }
        }

        if (capturing) {
            setTimeout(addSample, 200);
        } else {
            // draw blank to reset canvas content when tensors is set to null from menu
            if (tensors == null) {
                tf.tidy(() => {
                    const image = tf.ones([1, 224, 224, 3]);
                    dispatch(new Action("setSampleImage", { index: props.index, image: convertToImageData(image)}));
                });
            }
        }
    }, [capturing, tensors]);

    const toggleCapturing = () => {
        setCapturing(!capturing);
    }

    const badge;
    if (tensors == null) {
        badge = null;
    } else {
        badge = tensors.shape[0];
    }

    const canvasClassNames = [ "selector-canvas" ];
    if (appInfo.flipMode) {
        canvasClassNames.push("flip-image");
    }

    return <div className={"selector-cell" + (props.isPredicted ? " predicted" : "")} >
        <div className="selector-label" >
          <span className="mdl-chip" ><span className="mdl-chip__text">{ props.index + 1 }</span></span>
        </div>
        <div className="mdl-badge mdl-badge--overlap" data-badge={badge} >
          <canvas className={canvasClassNames.join(" ")} id={"canvas-" + props.index} width={IMAGE_SIZE} height={IMAGE_SIZE} ref={canvasRef} />
        </div>
        <button className="capture-button mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab mdl-button--colored" onClick={toggleCapturing} >
          { capturing ?
              <i className="material-icons">stop</i> :
              <i className="material-icons">add_a_photo</i> }
        </button>
    </div>;
};

const AddSelector = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    const incrementSelector = () => {
        dispatch(new Action("setSelectorNumber", appInfo.selectorNumber + 1));
    };
    return <div className="add-selector-cell" onClick={incrementSelector} >
        <button className="mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect">
            <i className="material-icons">add</i>
        </button>
    </div>;
};

const Selectors = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    let selectors = [];

    useEffect(() => {
        componentHandler.upgradeAllRegistered();
    }, [appInfo.tensors.length]);

    for (let i = 0; i < appInfo.selectorNumber; i++) {
        selectors.push(<Selector key={i} index={i} appInfo={appInfo} dispatch={dispatch} webcamRef={props.webcamRef} isPredicted={i == appInfo.predicted} imageData={appInfo.sampleImages[i]} />);
    }
    if ( appInfo.selectorNumber < MAX_LABELS ) {
        selectors.push(<AddSelector key="addSelector" index={appInfo.selectorNumber} appInfo={appInfo} dispatch={dispatch} />);
    }
    return <div id="selectors">{selectors}</div>
}

const Trainer = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;
    const phase = appInfo.phase;

    const [ modelKey, setModelKey ] = useState(null);

    const progressRef = useRef(null);

    async function epochCallback(e, logs) {
        console.log(`Epoch: ${e} Loss: ${logs.loss.toFixed(5)}`);
        if (progressRef.current) {
            progressRef.current.MaterialProgress.setProgress(e*2);
        }
    }

    useEffect(() => {
        if (phase == "training" || phase == "uploading") {
            componentHandler.upgradeAllRegistered();
        }
        if ((phase == "done" || phase == "uploaded") && appInfo.videoFlag) {
            let running = true;
            const video = props.webcamRef;
            const fn = () => {
                if (video && video.current) {
                    const image = capture(props.webcamRef);
                    const pred = tf.tidy(() => {
                        const label = appInfo.headNet.predict(appInfo.mobileNet.predict(image)).as1D().argMax();
                        return label;
                    });
                    dispatch(new Action("setPredicted", pred.dataSync()[0]));
                    image.dispose();
                    pred.dispose();
                }
                if (running) {
                    setTimeout(fn, 200);
                }
            }
            let tid = setTimeout(fn, 200);
            return () => {
                running = false;
                clearTimeout(tid);
            }
        }
    });

    function train() {
        dispatch(new Action("setPhase", "training"));

        setTimeout(() => {
            /* setup image dataset */
            let xs = null;
            let ys = null;
            for ( let i = 0; i < MAX_LABELS; i++) {
                const tensor = appInfo.tensors[i];
                if (tensor) {
                    if (xs == null) {
                        xs = tf.clone(tensor);
                        ys = tf.tidy(() => tf.oneHot((tf.ones([tensor.shape[0]]).mul(i)).toInt(), MAX_LABELS));
                    } else {
                        const oldX = xs;
                        const oldY = ys;
                        xs = oldX.concat(tensor, 0);
                        const labels = tf.tidy(() => tf.oneHot((tf.ones([tensor.shape[0]]).mul(i)).toInt(), MAX_LABELS));
                        ys = oldY.concat(labels, 0);
                        oldX.dispose();
                        oldY.dispose();
                        labels.dispose();
                    }
                }
            }

            if (xs == null){
                dispatch(new Action("setPhase", "init"));
                return
            }

            const net = tf.sequential({
                                      layers: [
                                          tf.layers.flatten({inputShape: [7,7,256]}),
                                          tf.layers.dense({
                                                          units: 100,
                                                          activation: "relu",
                                                          kernelInitializer: "varianceScaling",
                                                          useBias: true
                                          }),
                                          tf.layers.dense({
                                                          units: MAX_LABELS,
                                                          kernelInitializer: "varianceScaling",
                                                          useBias: false,
                                                          activation: "softmax"
                                          })
                                      ]
            });

            const optimizer = tf.train.adam(0.0001);
            net.compile({optimizer: optimizer, loss: "categoricalCrossentropy"});
            const batchSize = xs.shape[0];

            const epochs = 50;
            net.fit(xs, ys, {
                batchSize,
                epochs: epochs,
                callbacks: {
                    onEpochEnd: epochCallback
                }
            }).then(() => {
                xs.dispose();
                ys.dispose();
                optimizer.dispose();
                dispatch(new Action("setHeadNet", net));
                dispatch(new Action("setPhase", "done"));
            });
        }, 200);
    }

    function save() {
        dispatch(new Action("setVideoFlag", false));
        dispatch(new Action("setPhase", "uploading"));
        setTimeout(() => {
            appInfo.headNet.save(tf.io.withSaveHandler(modelSaveHandler(postURL))).then((key) => {
                setModelKey(key)
                dispatch(new Action("setVideoFlag", false));
                dispatch(new Action("setPhase", "uploaded"));
            }).catch(error => {
                console.log("Failed to save model: " + error);
                dispatch(new Action("setPhase", "done"));
            });
        }, 200);
    }

    const elms = [];

    if (phase == "init" || phase == "done" || phase == "uploaded") {
        elms.push(<div key="train-button" ><button id="train-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={train} >
                  {formatMessage({
                                 id: "train",
                                 default: "トレーニング",
                                 description: "Text message on train button."
                  })}
                  </button></div>);
    }
    if (phase == "training") {
        elms.push(<div key="progress-bar" className="training-progress-bar"><div className="mdl-progress mdl-js-progress" ref={progressRef} ></div></div>);
    }
    if (phase == "uploading") {
        elms.push(<div key="spinner" className="uploading-spinner"><div className="mdl-spinner mdl-js-spinner is-active"></div></div>);
    }
    if (phase == "done") {
        elms.push(<div key="save-button" >
                    <button id="save-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={save} >
                      {formatMessage({
                          id: "save",
                          default: "アップロード",
                          description: "Text message on upload button."
                      })}
                    </button>
                  </div>);
    }
    if (phase == "uploaded") {
        elms.push(<div className="access-key" key="model-key" >
                  {formatMessage({
                      id: "accessKey",
                      default: "カギをゲットした",
                      description: "Text message for accessKey."
                  })}
                  : <span>{modelKey}</span></div>);
    }

    return <div id="trainer">
        {elms}
        </div>
};

const Menu = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    const resetAll = () => {
        dispatch(new Action("resetAll"));
    };

    const loadFromFile = () => {
        if (!(window.FileList && window.FileReader && window.Blob)) {
            alert("The File APIs are not supported in your browser.");
            return;
        }
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.addEventListener("change", (e) => {
            const files = e.target.files;
            if (files.length < 1) {
                return;
            }
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target.result;
                const labels_num = (new Uint32Array(buffer, 0, 1))[0];
                if (labels_num > MAX_LABELS) {
                    alert("This file contains too many labels.");
                    return;
                }
                const sectionLengths = new Uint32Array(buffer, 1*4, labels_num);
                const tensors = [];
                const imageData = [];
                let cursor = (labels_num + 1)*4;
                for (let i = 0; i < labels_num; i++) {
                    if (sectionLengths[i] > 0) {
                        if (sectionLengths[i] % 4 != 0) {
                            alert("This file header contains invalid record size");
                            return;
                        }
                        const fnum = sectionLengths[i] / 4;
                        if (fnum % (7 * 7 * 256) != 0) {
                            alert("This file header contains invalid record size");
                            return;
                        }
                        const buf = new Float32Array(buffer, cursor, fnum);
                        cursor += sectionLengths[i];
                        const sampleNum = fnum / (7 * 7 * 256);
                        tensors.push(tf.tensor4d(buf, [sampleNum, 7, 7, 256]));
                    } else {
                        tensors.push(null);
                    }
                }
                const sampleImagesLengths = new Uint32Array(buffer, cursor, labels_num);
                cursor += labels_num * 4;
                for (let i = 0; i < labels_num; i++) {
                    if (sampleImagesLengths[i] > 0) {
                        const buff = new Uint8ClampedArray(buffer, cursor, sampleImagesLengths[i]);
                        const imgData = new ImageData(IMAGE_SIZE, IMAGE_SIZE);
                        for (let j = 0; j < buff.length; j++) {
                            imgData.data[j] = buff[j];
                        }
                        cursor += sampleImagesLengths[i];
                        imageData.push(imgData);
                    } else {
                        imageData.push(null);
                    }
                }
                dispatch(new Action("loadData", {
                    selectorNumber: labels_num,
                    tensors: tensors,
                    sampleImages: imageData
                });
            };
            reader.readAsArrayBuffer(file);
        });
        fileInput.click();
    };

    const saveToFile = () => {
        const blobs = [];
        const header = new Uint32Array(appInfo.selectorNumber+1);
        header[0] = appInfo.selectorNumber;
        let totalBytes = 0;
        const tensorBlobs = [];
        for (let i = 0; i < appInfo.selectorNumber; i++) {
            if (appInfo.tensors[i]){
                const t = appInfo.tensors[i].dataSync();
                const b = new Blob([t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength]);
                header[i+1] = b.size;
                totalBytes += b.size;
                tensorBlobs.push(b);
            } else {
                header[i+1] = 0;
            }
        }
        if (totalBytes == 0) {
            return;
        }
        blobs.push(new Blob([header]));
        tensorBlobs.forEach((b) => blobs.push(b));
        const sampleImagesHeader = new Uint32Array(appInfo.selectorNumber);
        const sampleImages = [];
        for (let i = 0; i < appInfo.selectorNumber; i++) {
            const simage = appInfo.sampleImages[i];
            if (simage) {
                const b = new Blob([simage.data]);
                sampleImagesHeader[i] = b.size;
                sampleImages.push(b);
            } else {
                sampleImagesHeader[i] = 0;
            }
        }
        blobs.push(new Blob([sampleImagesHeader]));
        sampleImages.forEach((b) => blobs.push(b));
        const totalBlob = new Blob(blobs, {type: "application/octet-stream"});
        const blobURL = URL.createObjectURL(totalBlob);
        const anchor = document.createElement("a");
        anchor.href = blobURL;
        anchor.target = "_blank";
        anchor.download = "ImageData.dat"
        anchor.click();
    };

    const toggleFlipMode = () => {
        dispatch(new Action("setFlipMode", !appInfo.flipMode));
    };

    return <div className="menu">
        <button id="menu-button" className="mdl-button mdl-js-button mdl-button--icon">
            <i className="material-icons">menu</i>
        </button>
        <ul className="mdl-menu mdl-menu--bottom-left mdl-js-menu" htmlFor="menu-button" >
            <li className="mdl-menu__item menu-item mdl-menu__item--full-bleed-divider" onClick={toggleFlipMode}>Flip Image</li>
            <li className="mdl-menu__item menu-item" onClick={resetAll} >Reset</li>
            <li className="mdl-menu__item menu-item" onClick={loadFromFile} >Load from file</li>
            <li className="mdl-menu__item menu-item" onClick={saveToFile} >Save to file</li>
        </ul>
        </div>
};

const Main = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    const webcamRef = useRef(null);

    if (appInfo.mobileNet) {
        return <div className="main">
                <WebCam appInfo={appInfo} dispatch={dispatch} webcamRef={webcamRef} />
                <Selectors appInfo={appInfo} dispatch={dispatch} webcamRef={webcamRef} />
                <Trainer appInfo={appInfo} dispatch={dispatch} webcamRef={webcamRef} />
            </div>
    } else {
        return <div className="main"><span className="loading-message">Loading models...</spam></div>
    }
};

function appReducer(appInfo: any, action: Action) {
    switch(action.type) {
    case "setMobileNet":
        return { ...appInfo, ...{ mobileNet: action.data } };
    case "setHeadNet":
        if (appInfo.headNet) {
            appInfo.headNet.dispose();
        }
        return { ...appInfo, ...{ headNet: action.data } };
    case "setPhase":
        return { ...appInfo, ...{ phase: action.data } };
    case "setTensor":
        const newTensors = [];
        for (let i = 0; i < MAX_LABELS; i++) {
            if (i == action.data.index) {
                newTensors[i] = action.data.tensor;
            } else {
                newTensors[i] = appInfo.tensors[i];
            }
        }
        return { ...appInfo, ...{ tensors: newTensors }};
    case "setSampleImage":
        const newSampleImages = [];
        for (let i = 0; i < MAX_LABELS; i++) {
            if (i == action.data.index) {
                newSampleImages[i] = action.data.image;
            } else {
                newSampleImages[i] = appInfo.sampleImages[i];
            }
        }
        return { ...appInfo, ...{ sampleImages: newSampleImages }};
    case "setSelectorNumber":
        return { ...appInfo, ...{ selectorNumber: action.data }};
    case "setVideoFlag":
        return { ...appInfo, ...{ videoFlag: action.data, predicted: (action.data) ? appInfo.predicted : null }};
    case "setPredicted":
        return { ...appInfo, ...{ predicted: appInfo.videoFlag ? action.data : null }};
    case "setFlipMode":
        return { ...appInfo, ...{ flipMode: action.data } };
    case "resetAll":
        return {
            ...appInfo,
            ...{
                phase: "init",
                selectorNumber: 2,
                tensors: Array.apply(null, Array(MAX_LABELS)).map(function(){return null;}),
                sampleImages: Array.apply(null, Array(MAX_LABELS)).map(function(){return null;}),
                predicted: null,
                headNet: null
            }
        };
    case "loadData":
        return { ...appInfo, ...action.data };
    default:
        return appInfo;
    }
}

const Application = () => {
    const initialAppInfo = {
        phase: "init",
        flipMode: true,
        videoFlag: true,
        selectorNumber: 2,
        tensors: Array.apply(null, Array(MAX_LABELS)).map(function(){return null;}),
        sampleImages: Array.apply(null, Array(MAX_LABELS)).map(function(){return null;}),
        mobileNet: null,
        headNet: null
    };
    const [ appInfo, dispatch ] = useReducer(appReducer, initialAppInfo);

    // Assume that if the device has multiple camera devices, it could be smartphone and the backend camera will be used
    useEffect(() => {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then((info) => {
                if (info.filter((d) => (d.kind == "videoinput")).length > 1) {
                    dispatch(new Action("setFlipMode", false));
                }
            });
        }
    }, []);

    for ( let i = 0; i < MAX_LABELS; i++ ) {
        useEffect(() => {
            return () => {
                if (appInfo.tensors[i]) {
                    appInfo.tensors[i].dispose();
                }
            };
        }, [appInfo.tensors[i]]);
    }

    useEffect(() => {
        let rootNet = null;
        if (appInfo.mobileNet == null) {
            tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json').then(net => {
                rootNet = net;
                const layer = net.getLayer('conv_pw_13_relu');
                const truncatedNet = tf.model({inputs: net.inputs, outputs: layer.output});
                // warm up;
                tf.tidy(() => {
                    truncatedNet.predict(tf.zeros([1, 224, 224, 3]));
                });
                dispatch(new Action("setMobileNet", truncatedNet));
            });
        }

        return () => {
            if (rootNet) {
                rootNet.dispose();
            }
        };
    }, []);

    return <div className="root">
            <Header />
            <Menu appInfo={appInfo} dispatch={dispatch} />
            <Main appInfo={appInfo} dispatch={dispatch} />
        </div>;
};

ReactDOM.render(<Application />, document.getElementById('app'));

// vim:ft=javascript sw=4
