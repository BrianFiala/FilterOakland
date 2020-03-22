'use strict';

const fs = require('fs');
const ObjectsToCsv = require('objects-to-csv');

const jsonParser = (rawData) => JSON.parse(rawData);

const owner_occupied_json = fs.readFileSync('./owner_occupied.json');
const ownerOccupied = jsonParser(owner_occupied_json);
const voters_json = fs.readFileSync('./voters.json');
let hadError = false;
let oaklandVoters = [];
let ownerOccupiedWithAllVoterInfo = [];

const useOnlyOaklandVoters = true;
if (useOnlyOaklandVoters) {
  oaklandVoters = jsonParser(voters_json).filter(voter => voter['mail_city'].toUpperCase().includes('OAKLAND') || voter['city'].toUpperCase().includes('OAKLAND'));
} else {
  oaklandVoters = jsonParser(voters_json);
}

/**
 * returns true if the owner name contains both non-empty first and last names of voter
 * @param owner
 * @param voter
 * @returns {boolean}
 */
const ownerNameMatchesVoterName = (owner, voter) => {
    return ownerNameMatchesVoterLastName(owner, voter)
      && ownerNameMatchesVoterFirstName(owner, voter);
};

/**
 * returns true if the voter last name is non empty and is in owner name
 * @param owner
 * @param voter
 * @returns {boolean}
 */
const ownerNameMatchesVoterLastName = (owner, voter) => {
  try {
    const ownerName = owner['Owner Name 1'].trim().toUpperCase();
    const voterLastName = voter['name_last'].trim().toUpperCase();

    return ownerName.length && voterLastName.length
      && ownerName.includes(voterLastName);

  } catch (err) {
    hadError = true;
    console.log('ERROR: name matching');
    return false;
  }
};

/**
 * returns true if the voter first name is non empty and is in owner name
 * @param owner
 * @param voter
 * @returns {boolean}
 */
const ownerNameMatchesVoterFirstName = (owner, voter) => {
  try {
    const ownerName = owner['Owner Name 1'].trim().toUpperCase();
    const voterFirstName = voter['name_first'].trim().toUpperCase();

    return ownerName.length && voterFirstName.length
      && ownerName.includes(voterFirstName);

  } catch (err) {
    hadError = true;
    console.log('ERROR: name matching');
    return false;
  }
};

/**
 * returns true if the first five digits of ownerZip match either the first five digits of voter zip or voter mail zip
 * @param owner
 * @param voter
 * @returns {boolean}
 */
const ownerZipCodeMatchesVoterZipCode = (owner, voter) => {
  try {
    const ownerZipCode = owner['Owner Zip'].trim().substring(0,5).toUpperCase();
    const voterZipCode = voter['zip'].trim().substring(0,5).toUpperCase();
    const voterMailZipCode = voter['mail_zip'].trim().substring(0,5).toUpperCase();

    return ownerZipCode === voterZipCode
      || ownerZipCode === voterMailZipCode;

  } catch (err) {
    hadError = true;
    console.log('ERROR: zip matching');
    return false;
  }
};

/**
 * returns true if the owner address contains the voter house number and street, or if the voter mail address contains owner address, or vice-versa
 * @param owner
 * @param voter
 * @returns {boolean|boolean}
 */
const ownerAddressMatchesVoterAddress = (owner, voter) => {
  try {
    const ownerAddress = owner['Owner Address'].trim().toUpperCase();
    const voterHouseNumber = voter['house_number'].trim().toUpperCase();
    const voterStreet = voter['street'].trim().toUpperCase();
    const voterMailAddress = voter['mail_street'].trim().toUpperCase();

    const ownerAddressMatchesVoterNumberStreet = ownerAddress.length && voterHouseNumber.length && voterStreet.length
      && ownerAddress.includes(voterHouseNumber) && ownerAddress.includes(voterStreet);

    const ownerAddressMatchesVoterMailAddress = ownerAddress.length && voterMailAddress.length
      && (ownerAddress.includes(voterMailAddress) || voterMailAddress.includes(ownerAddress));

    return ownerZipCodeMatchesVoterZipCode(owner, voter)
      && (ownerAddressMatchesVoterNumberStreet
        || ownerAddressMatchesVoterMailAddress);

  } catch(err) {
    hadError = true;
    console.log('ERROR: address matching');
    return false;
  }
};

let ownerNumber = 0;
let matchConfidenceCounts = {
  nameOnly: 0,
  addressOnly: 0,
  firstNameAndAddress: 0,
  lastNameAndAddress: 0,
  fullNameAndAddress: 0,
};

for (const owner of ownerOccupied) {
  ++ownerNumber;
  let matchNumber = 0;
  let matchConfidence;

  for (const voter of oaklandVoters) {
    matchConfidence = '';
    const ownerMatchesName = ownerNameMatchesVoterName(owner, voter);
    const ownerMatchesLastName = ownerNameMatchesVoterLastName(owner, voter);
    const ownerMatchesFirstName = ownerNameMatchesVoterFirstName(owner, voter);
    const ownerMatchesAddress = ownerAddressMatchesVoterAddress(owner, voter);

    if (ownerMatchesName && ownerMatchesAddress) {
      ++matchConfidenceCounts.fullNameAndAddress;
      matchConfidence = 'full name and address';
    } else if (ownerMatchesLastName && ownerMatchesAddress) {
      ++matchConfidenceCounts.lastNameAndAddress;
      matchConfidence = 'last name and address';
    } else if (ownerMatchesFirstName && ownerMatchesAddress) {
      ++matchConfidenceCounts.firstNameAndAddress;
      matchConfidence = 'first name and address';
    } else if (ownerMatchesAddress) {
      ++matchConfidenceCounts.addressOnly;
      matchConfidence = 'address only';
    } else if (ownerMatchesName) {
      ++matchConfidenceCounts.nameOnly;
      matchConfidence = 'name only';
    }

    if (matchConfidence) {
      console.log(`owner ${ownerNumber} found match number ${++matchNumber} with match confidence: ${matchConfidence}`);
      ownerOccupiedWithAllVoterInfo.push({
        'match confidence': matchConfidence,
        'OWNER name' : owner['Owner Name 1'],
        'OWNER address' : owner['Owner Address'],
        'OWNER zip' : owner['Owner Zip'],
        'voter name': `${voter['name_prefix'] ? `${voter['name_prefix']} ` : ''}${voter['name_first']}${voter['name_middle'] ? ` ${voter['name_middle']}` : '' }${voter['name_last'] ? ` ${voter['name_last']}` : ''}${voter['name_suffix'] ? ` ${voter['name_suffix']}` : ''}`,
        'voter address': `${voter['house_number']}${voter['house_fraction'] ? ` ${voter['house_fraction']}` : ''}${voter['pre_dir'] ? ` ${voter['pre_dir']}` : ''}${voter['street'] ? ` ${voter['street']}` : ''}${voter['type'] ? ` ${voter['type']}` : ''}${voter['post_dir'] ? ` ${voter['post_dir']}` : ''}${voter['building_number'] ? ` ${voter['building_number']}` : ''}${voter['apartment_number'] ? ` ${voter['apartment_number']}` : ''}`,
        'voter zip': voter['zip'],
        'voter "mail_street"': voter['mail_street'],
        'voter "mail_zip"': voter['mail_zip'],
        'voter phone 1': voter['phone_1'],
        'voter phone 2': voter['phone_2'],
        'voter id': voter['voter_id'],
        'voter email': voter['email']
      });
    }
  }
}

const sortedOwnerOccupiedWithAllVoterInfo = ownerOccupiedWithAllVoterInfo.sort((a, b) => {
  function entryPriority(entry) {
    switch (entry['match confidence']) {
      case 'full name and address': return 5;
      case 'last name and address': return 4;
      case 'first name and address': return 3;
      case 'address only': return 2;
      case 'name only': return 1;
      default: return 0;
    }
  }

  return entryPriority(b) - entryPriority(a);
});

(async () => {
  try {
    fs.unlinkSync('./owner_occupied_voter_matches.json');
    fs.unlinkSync('./owner_occupied_voter_matches.csv');
  } catch(err) {}
  const csv = new ObjectsToCsv(sortedOwnerOccupiedWithAllVoterInfo);
  const jsonString = JSON.stringify(sortedOwnerOccupiedWithAllVoterInfo);
  fs.writeFileSync('./owner_occupied_voter_matches.json', jsonString);
  await csv.toDisk('./owner_occupied_voter_matches.csv');
})();

console.log(`had error: ${hadError}`);
console.log(`full name and address matches: ${matchConfidenceCounts.fullNameAndAddress}`);
console.log(`only last name and address matches: ${matchConfidenceCounts.lastNameAndAddress}`);
console.log(`only first name and address matches: ${matchConfidenceCounts.firstNameAndAddress}`);
console.log(`only address matches: ${matchConfidenceCounts.addressOnly}`);
console.log(`only name matches: ${matchConfidenceCounts.nameOnly}`);
