'use strict';
const fs = require('fs');
const ObjectsToCsv = require('objects-to-csv');
let voters = require('./src_data/voters.json').filter(voter => !!voter.email || !!voter.phone_1 || !!voter.phone_2);
let berkeleyOccupied = require('./src_data/berkeley_occupied.json');
let berkeleyAbsentee = require('./src_data/berkeley_absentee.json');
let combinedHomeownerList = require('./src_data/combined_homeowner_list.json');
let oaklandResidentApartmentOwners = require('./src_data/oakland_resident_apartment_owners.json');
let ownerOccupied = require('./src_data/owner_occupied.json');

const addOwnerType = (owners, ownerType) => {
  for (const owner of owners) {
    owner.ownerType = ownerType;
  }
};

addOwnerType(berkeleyOccupied, 'Berkeley Occupied');
addOwnerType(berkeleyAbsentee, 'Berkeley Absentee');
addOwnerType(combinedHomeownerList, 'Homeowner');
addOwnerType(oaklandResidentApartmentOwners, 'Oakland Apt Occupied');
addOwnerType(ownerOccupied, 'Owner Occupied');

const owners = berkeleyOccupied.concat(berkeleyAbsentee.concat(combinedHomeownerList.concat(oaklandResidentApartmentOwners.concat(ownerOccupied))));
berkeleyOccupied, berkeleyAbsentee, combinedHomeownerList, oaklandResidentApartmentOwners, ownerOccupied = null;

const ownerNameMatchesVoterLastName = (ownerName, voterLastName) => {
  return ownerName.length && voterLastName.length
    && ownerName.includes(voterLastName);
};

const ownerNameMatchesVoterFirstName = (ownerName, voterFirstName) => {
  return ownerName.length && voterFirstName.length
    && ownerName.includes(voterFirstName);
};

const ownerZipCodeMatchesVoterZipCode = (ownerZipCode, voterZipCode, voterMailZipCode) => {
  return ownerZipCode === voterZipCode
    || ownerZipCode === voterMailZipCode;
};

const ownerAddressMatchesVoterNumberStreet = (ownerAddress, voterHouseNumber, voterStreet) => {
  return ownerAddress.length && voterHouseNumber.length && voterStreet.length
    && ownerAddress.includes(voterHouseNumber) && ownerAddress.includes(voterStreet);
}

const ownerAddressMatchesVoterMailAddress = (ownerAddress, voterMailAddress) => {
  return ownerAddress.length && voterMailAddress.length
    && (ownerAddress.includes(voterMailAddress) || voterMailAddress.includes(ownerAddress));
}

const ownerAddressMatchesVoterAddress = (ownerAddress, voterHouseNumber, voterStreet, voterMailAddress, ownerZipCode, voterZipCode, voterMailZipCode) => {
  return ownerZipCodeMatchesVoterZipCode(ownerZipCode, voterZipCode, voterMailZipCode)
    && (ownerAddressMatchesVoterNumberStreet(ownerAddress, voterHouseNumber, voterStreet)
      || ownerAddressMatchesVoterMailAddress(ownerAddress, voterMailAddress));
};

let hadError = false;
let ownerVoterInfo = [];

let ownerNumber = 0;
let matchConfidenceCounts = {
  lastNameAndAddress: 0,
  fullNameAndAddress: 0,
};

for (const owner of owners) {
  ++ownerNumber;
  let matchNumber = 0;
  let matchConfidence;
  const ownerName = owner['OwnerName1'].trim().toUpperCase().split(' ');
  const ownerAddress = owner['OwnerAddress'].trim().toUpperCase().split(' ');
  const ownerZipCode = owner['OwnerZip'].trim().substring(0,5).toUpperCase();

  for (const voter of voters) {
    try {
      matchConfidence = '';
      const voterLastName = voter['name_last'].trim().toUpperCase();
      const voterFirstName = voter['name_first'].trim().toUpperCase();
      const voterHouseNumber = voter['house_number'].trim().toUpperCase();
      const voterStreet = voter['street'].trim().toUpperCase();
      const voterMailAddress = voter['mail_street'].trim().toUpperCase();
      const voterZipCode = voter['zip'].trim().substring(0,5).toUpperCase();
      const voterMailZipCode = voter['mail_zip'].trim().substring(0,5).toUpperCase();

      const ownerMatchesLastName = ownerNameMatchesVoterLastName(ownerName, voterLastName);
      const ownerMatchesFirstName = ownerNameMatchesVoterFirstName(ownerName, voterFirstName);
      const ownerMatchesName = ownerMatchesLastName && ownerMatchesFirstName;
      const ownerMatchesAddress = ownerAddressMatchesVoterAddress(ownerAddress, voterHouseNumber, voterStreet, voterMailAddress, ownerZipCode, voterZipCode, voterMailZipCode);
  
      if (ownerMatchesName && ownerMatchesAddress) {
        ++matchConfidenceCounts.fullNameAndAddress;
        matchConfidence = 'full name and address';
      } else if (ownerMatchesLastName && ownerMatchesAddress) {
        ++matchConfidenceCounts.lastNameAndAddress;
        matchConfidence = 'last name and address';
      }
  
      if (matchConfidence) {
        console.log(`owner ${ownerNumber} found match number ${++matchNumber} with match confidence: ${matchConfidence}`);
        ownerVoterInfo.push({
          'match confidence': matchConfidence,
          'OWNER type' : owner.ownertype,
          'OWNER name' : owner['OwnerName1'],
          'OWNER address' : owner['OwnerAddress'],
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
    } catch (err) {
      hadError = true;
      console.log('ERROR: parsing owner or voter info');
    }
  }
}

const sortedOwnerVoterInfo = ownerVoterInfo.sort((a, b) => {
  function entryPriority(entry) {
    switch (entry['match confidence']) {
      case 'full name and address': return 2;
      case 'last name and address': return 1;
      default: return 0;
    }
  }

  return entryPriority(b) - entryPriority(a);
});

ownerVoterInfo = null;

(async () => {
  try {
    fs.unlinkSync('./results/matches.json');
    fs.unlinkSync('./results/matches.csv');
  } catch(err) {}
  fs.writeFileSync('./results/matches.json', JSON.stringify(sortedOwnerVoterInfo));
  await (new ObjectsToCsv(sortedOwnerVoterInfo)).toDisk('./results/matches.csv');
})();

console.log(`had error: ${hadError}`);
console.log(`full name and address matches: ${matchConfidenceCounts.fullNameAndAddress}`);
console.log(`only last name and address matches: ${matchConfidenceCounts.lastNameAndAddress}`);
