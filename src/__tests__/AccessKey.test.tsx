import React from "react";
import { render, fireEvent, waitForElement } from "@testing-library/react";

import AccessKey from "../AccessKey";

function renderAccessKey(props={}) {
      const defaultProps = {
          label: "Copy Key",
          accessKey: "00000000"
      };
      return render(<AccessKey {...defaultProps} {...props} />);
}

describe("<AccessKey />", () => {
    test("should display copy key button", async () => {
        const { getByTestId } = renderAccessKey();
        const accessKeyButton = getByTestId("access-key-copy");

        expect(accessKeyButton).toBeVisible();
        expect(accessKeyButton).toHaveTextContent("Copy Key");

        //fireEvent.click(accessKeyButton);
    });

    test("should not display access key with null", async () => {
        const { queryByTestId } = renderAccessKey({accessKey: null});
        const accessKey = queryByTestId("access-key-text");

        expect(accessKey).toBeNull();
    });

    test("should display access key", async () => {
        const { getByTestId } = renderAccessKey();
        const accessKey = getByTestId("access-key-text");

        expect(accessKey).toBeVisible();
        expect(accessKey).toHaveTextContent("00000000");
    });
});

// vim:ft=javascript sw=4
