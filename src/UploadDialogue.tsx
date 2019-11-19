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

import formatMessage from "format-message";
import React, { useState, useEffect, useRef } from 'react';

import Action from "./Action";
import SaveModel from "./SaveModel";

export default function UploadDialogue(props) {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;
    const show = props.show;
    const text1 = formatMessage({ id: "uploadDialogue1",
                                   default: "アップロードしますか",
                                   description: "Text message on upload dialogue."});
    const text2 = formatMessage({ id: "uploadDialogue2",
                                default: "アップロードしますか",
                                description: "Text message on upload dialogue."});
    const uploadLabel = formatMessage({ id: "save",
                                        default: "アップロード",
                                        description: "Text message on upload button."});
    const cancelLabel = formatMessage({ id: "cancel",
                                        default: "キャンセル",
                                        description: "Text message on cancel button."});

    const cancel = () {
        dispatch(new Action("setPhase", "done"));
    };

    const maskClasses = [ "dialogue-mask" ];

    if (show) {
        maskClasses.push("visible");
    }

    return <div key="dialogue-mask" className={maskClasses.join(" ")} >
        <div key="dialogue" className="dialogue" >
          <span>{text1}<br />{text2}</span>
          <button className="save-button" onClick={SaveModel(appInfo, dispatch, appInfo.phase)} >{uploadLabel}</button>
          <button className="cancel-button" onClick={cancel} >{cancelLabel}</button>
        </div>
      </div>;
}

// vim:ft=javascript sw=4
