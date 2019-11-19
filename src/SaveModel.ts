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

import Action from "./Action";
import modelSaveHandler from "./modelSave";

const postURL = "https://scratch-image-model-dot-ai-for-edu.appspot.com/models";

export default function SaveModel(appInfo, dispatch, phase) {
    return () => {
        if (phase != "done" && phase != "showUploadDialogue") {
            return;
        }
        dispatch(new Action("setVideoFlag", false));
        setTimeout(() => {
            appInfo.headNet.save(tf.io.withSaveHandler(modelSaveHandler(postURL))).then((key) => {
                dispatch(new Action("setVideoFlag", false));
                dispatch(new Action("setModelKey", key));
                dispatch(new Action("setPhase", "done"));
            }).catch(error => {
                console.log("Failed to save model: " + error);
                dispatch(new Action("setPhase", "done"));
            });
        }, 200);
    };
};

// vim:ft=javascript sw=4
