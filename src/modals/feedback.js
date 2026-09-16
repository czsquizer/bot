const { Modal } = require('@eartharoid/dbf');
const ExtendedEmbedBuilder = require('../lib/embed');
const { MessageFlags } = require('discord.js');
const { pools } = require('../lib/threads');

const { crypto } = pools;
module.exports = class FeedbackModal extends Modal {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'feedback',
		});
	}

	/**
	 * @param {*} id
	 * @param {import("discord.js").ModalSubmitInteraction} interaction
	 */
	async run(id, interaction) {
		/** @type {import("client")} */
		const client = this.client;

		await interaction.deferReply();

		const comment = interaction.fields.getTextInputValue('comment');
		let rating = parseInt(interaction.fields.getTextInputValue('rating')) || null; // any integer, or null if NaN
		rating = Math.min(Math.max(rating, 1), 5); // clamp between 1 and 5 (0 and null become 1, 6 becomes 5)

		const data = {
			comment: comment?.length > 0 ? await crypto.queue(w => w.encrypt(comment)) : null,
			guild: { connect: { id: interaction.guild.id } },
			rating,
			user: { connect: { id: interaction.user.id } },
		};
		const ticket = await client.prisma.ticket.update({
			data: {
				feedback: {
					upsert: {
						create: data,
						update: data,
					},
				},
			},
			include: { guild: true },
			where: { id: interaction.channel.id },
		});


		const getMessage = client.i18n.getLocale(ticket.guild.locale);

		// the interaction is already deferred (above), so `followUp` is allowed here.
		// it must be sent BEFORE closing, because closing deletes the channel
		if (comment?.length > 0 && rating !== null) {
			await interaction.followUp({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.primaryColour)
						.setDescription(getMessage('ticket.feedback')),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		// `requestClose` is kept only for modals opened before this change; both now close immediately
		if (id.next === 'closeNow' || id.next === 'requestClose') await client.tickets.closeNow(interaction, id.reason);
		else if (id.next === 'acceptClose') await client.tickets.acceptClose(interaction);
	}
};
