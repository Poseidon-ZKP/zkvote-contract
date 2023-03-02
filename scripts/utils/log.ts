import log4js from "log4js"
export const logger = log4js.getLogger();
if (process.env.LOG_LEVEL_DEBUG) {
	logger.level = "debug";
	logger.debug("log4js level debug");
} else {
	logger.level = "info";
	logger.info("log4js level info");
}