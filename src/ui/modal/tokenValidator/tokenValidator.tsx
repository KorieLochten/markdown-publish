import { useEffect, useState } from "react";
import { usePluginContext } from "../../context";
import styles from "./tokenValidator.module.css";
import { Button } from "../../components";
import { Modal } from "obsidian";

interface TokenValidatorModalProps {
  modal: Modal;
  site: "Medium" | "Dev.to" | "Imgur";
}

const Tutorial = ({ site }: { site: "Medium" | "Dev.to" | "Imgur" }) => {
  return (
    <>
      {site === "Medium" ? (
        <div>
          <h2>Integrate Medium</h2>
          <ul>
            <li>
              Go to your Medium{" "}
              <a href="https://medium.com/me/settings/security">
                security and apps
              </a>
            </li>
            <li>
              Click on the integration tokens and create a new token. Copy the
              token and paste it below.
            </li>
          </ul>
        </div>
      ) : site === "Dev.to" ? (
        <div>
          <h2>Integrate Dev.to</h2>
          <ul>
            <li>
              Go to your Dev.to{" "}
              <a href="https://dev.to/settings/extensions">extensions</a>
            </li>
            <li>
              Click on the <b>Generate new token</b> button. Copy the token and
              paste it below.
            </li>
          </ul>
        </div>
      ) : (
        <div>
          <h2>Integrate Imgur</h2>
          <ul>
            <li>
              Go to your Imgur{" "}
              <a href="https://imgur.com/account/settings/apps">apps</a>
            </li>
            <li>
              Click on the <b>Register an Application</b> button. Copy the
              Client ID and paste it below.
            </li>
          </ul>
        </div>
      )}
    </>
  );
};

export const TokenValidatorModal = ({
  modal,
  site
}: TokenValidatorModalProps) => {
  return (
    <div className={styles["token-modal"]}>
      <Tutorial site={site} />
      <TokenInput
        onConfirm={() => {
          modal.close();
        }}
        site={site}
      />
    </div>
  );
};

interface TokenInputProps {
  onConfirm: () => void;
  site: "Medium" | "Dev.to" | "Imgur";
}

const TokenInput = ({ onConfirm, site }: TokenInputProps) => {
  const { plugin } = usePluginContext();
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(
      site === "Medium"
        ? plugin.settings.mediumToken
        : site === "Dev.to"
        ? plugin.settings.devtoToken
        : plugin.settings.imgurClientId
    );
  }, []);

  const onClick = async () => {
    switch (site) {
      case "Medium":
        await plugin.services.api
          .validateMediumToken(token)
          .then(async (isHealthy) => {
            if (isHealthy) {
              plugin.settings.mediumToken = token;
              await plugin.saveSettings();
              onConfirm();
            }
          });
        break;
      case "Dev.to":
        await plugin.services.api
          .validateDevtoToken(token)
          .then(async (isHealthy) => {
            if (isHealthy) {
              plugin.settings.devtoToken = token;
              await plugin.saveSettings();
              onConfirm();
            }
          });
        break;
      case "Imgur":
        plugin.settings.imgurClientId = token;
        await plugin.saveSettings();
        onConfirm();
        break;
    }
  };

  return (
    <div>
      <p>API Token</p>
      <div className={styles["token-input"]}>
        <input
          type="text"
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
          }}
        />
        <Button name="Confirm" style="primary" onClick={onClick} />
      </div>
    </div>
  );
};
